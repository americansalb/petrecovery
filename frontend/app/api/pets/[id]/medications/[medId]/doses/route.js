/**
 * Dose Log API
 *
 * POST   /api/pets/[id]/medications/[medId]/doses - Mark a slot given/skipped
 *        Body: { scheduledFor: ISO, status: 'GIVEN'|'SKIPPED', notes?, givenAt? }
 * DELETE /api/pets/[id]/medications/[medId]/doses?scheduledFor=ISO - Undo a log
 *
 * Data-safety properties (this is medical data):
 *  - One row per (medication, slot), enforced by a DB unique constraint.
 *  - Double-dose guard: if a slot is already GIVEN and another GIVEN arrives
 *    (two caregivers tapping at once), the existing record is returned
 *    untouched with alreadyLogged: true. Nothing is silently overwritten.
 *  - Undo is a tombstone (deletedAt), never a hard delete. Re-logging the
 *    slot revives the same row.
 *  - Every mutation appends to MedicationAuditLog inside the SAME
 *    transaction, with a full snapshot and the acting user.
 *  - Supply counters change in that same transaction and never drift below 0.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';
import { audit, AUDIT_ACTIONS } from '@/app/lib/medicationAudit';

async function findOwnedMedication(petId, medId) {
  const medication = await prisma.petMedication.findUnique({ where: { id: medId } });
  if (!medication || medication.petId !== petId || medication.deletedAt) return null;
  return medication;
}

function supplyDelta(prevStatus, nextStatus) {
  const wasGiven = prevStatus === 'GIVEN';
  const isGiven = nextStatus === 'GIVEN';
  if (!wasGiven && isGiven) return -1;
  if (wasGiven && !isGiven) return 1;
  return 0;
}

// POST /api/pets/[id]/medications/[medId]/doses
export async function POST(request, { params }) {
  try {
    const { id, medId } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const medication = await findOwnedMedication(id, medId);
    if (!medication) return NextResponse.json({ error: 'Medication not found' }, { status: 404 });

    const body = await request.json();
    const scheduledFor = new Date(body.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledFor' }, { status: 400 });
    }
    // Keep logs near the present. Blocks accidental far-future check-offs.
    const drift = Math.abs(Date.now() - scheduledFor.getTime());
    if (drift > 370 * 86400000) {
      return NextResponse.json({ error: 'Date out of range' }, { status: 400 });
    }

    const status = body.status === 'SKIPPED' ? 'SKIPPED' : 'GIVEN';
    const notes = (body.notes || '').trim().slice(0, 500) || null;
    const givenAt = status === 'GIVEN' ? new Date(body.givenAt || Date.now()) : null;

    const existing = await prisma.medicationDose.findUnique({
      where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
    });

    // Double-dose guard: a live GIVEN record is never overwritten by another
    // GIVEN. The second caregiver gets the original record back so their UI
    // shows who already gave it and when.
    if (existing && !existing.deletedAt && existing.status === 'GIVEN' && status === 'GIVEN') {
      return NextResponse.json({
        dose: existing,
        quantityRemaining: medication.quantityRemaining,
        alreadyLogged: true,
      });
    }

    // A voided (undone) row doesn't count toward supply.
    const prevStatus = existing && !existing.deletedAt ? existing.status : null;
    const delta = supplyDelta(prevStatus, status);
    const isRevival = Boolean(existing);

    const result = await prisma.$transaction(async (tx) => {
      const dose = await tx.medicationDose.upsert({
        where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
        update: { status, notes, givenAt, deletedAt: null },
        create: { medicationId: medId, scheduledFor, status, notes, givenAt },
      });

      const updatedMed = await tx.petMedication.update({
        where: { id: medId },
        data:
          medication.quantityRemaining != null && delta !== 0
            ? { quantityRemaining: Math.max(0, medication.quantityRemaining + delta) }
            : {},
      });

      await audit(tx, {
        petId: id,
        medicationId: medId,
        doseId: dose.id,
        action: isRevival ? AUDIT_ACTIONS.DOSE_CHANGED : AUDIT_ACTIONS.DOSE_LOGGED,
        actorUserId: auth.user.id,
        snapshot: { before: existing || null, after: dose, supplyDelta: delta },
      });

      return { dose, quantityRemaining: updatedMed.quantityRemaining };
    });

    return NextResponse.json(result, { status: isRevival ? 200 : 201 });
  } catch (error) {
    console.error('[MEDS API] Error logging dose:', error);
    return NextResponse.json({ error: 'Failed to log dose' }, { status: 500 });
  }
}

// DELETE /api/pets/[id]/medications/[medId]/doses?scheduledFor=ISO
export async function DELETE(request, { params }) {
  try {
    const { id, medId } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const medication = await findOwnedMedication(id, medId);
    if (!medication) return NextResponse.json({ error: 'Medication not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const scheduledFor = new Date(searchParams.get('scheduledFor'));
    if (Number.isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledFor' }, { status: 400 });
    }

    const existing = await prisma.medicationDose.findUnique({
      where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'No log for that slot' }, { status: 404 });
    }

    const delta = supplyDelta(existing.status, null);

    const result = await prisma.$transaction(async (tx) => {
      // Tombstone instead of delete: the record stays recoverable forever.
      const voided = await tx.medicationDose.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      const updatedMed = await tx.petMedication.update({
        where: { id: medId },
        data:
          medication.quantityRemaining != null && delta !== 0
            ? { quantityRemaining: Math.max(0, medication.quantityRemaining + delta) }
            : {},
      });

      await audit(tx, {
        petId: id,
        medicationId: medId,
        doseId: existing.id,
        action: AUDIT_ACTIONS.DOSE_VOIDED,
        actorUserId: auth.user.id,
        snapshot: { before: existing, after: voided, supplyDelta: delta },
      });

      return { quantityRemaining: updatedMed.quantityRemaining };
    });

    return NextResponse.json({ message: 'Undone', ...result });
  } catch (error) {
    console.error('[MEDS API] Error undoing dose:', error);
    return NextResponse.json({ error: 'Failed to undo dose' }, { status: 500 });
  }
}
