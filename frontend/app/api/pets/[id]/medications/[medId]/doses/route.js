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
// A unique index on slotKey would be the tidier guarantee, but adding one to a
// live table is exactly the migration the deploy's bare `prisma db push`
// cannot carry - so the slot's canonical instant carries it through the index
// that already exists.
import { canonicalInstantForSlot } from '@/lib/medications';

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

/** Apply a supply change atomically, clamped at zero.
 *  Reading the count before the transaction and writing back read+delta loses
 *  one of two concurrent decrements; increment is computed by the database. */
async function applySupply(tx, medId, hasSupply, delta) {
  if (!hasSupply || delta === 0) return;
  await tx.petMedication.update({ where: { id: medId }, data: { quantityRemaining: { increment: delta } } });
  await tx.petMedication.updateMany({
    where: { id: medId, quantityRemaining: { lt: 0 } },
    data: { quantityRemaining: 0 },
  });
}

// POST /api/pets/[id]/medications/[medId]/doses
export async function POST(request, { params }) {
  try {
    const { id, medId } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const medication = await findOwnedMedication(id, medId);
    if (!medication) return NextResponse.json({ error: 'Medication not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
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
    // A malformed givenAt used to reach Prisma as an Invalid Date and fail the
    // whole write with a 500, so a caregiver's tap on a bad payload lost the
    // dose entirely. Fall back to now instead.
    let givenAt = null;
    if (status === 'GIVEN') {
      const parsed = body.givenAt ? new Date(body.givenAt) : new Date();
      givenAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    // Timezone-independent slot identity (new clients send it; legacy rows and
    // PRN doses have none). It is what makes two caregivers in different
    // timezones, or a re-timed schedule, resolve to the SAME dose row.
    const slotKey = typeof body.slotKey === 'string' && body.slotKey ? body.slotKey : null;

    // Find the slot's existing row by slotKey first (this recognizes a log made
    // from another timezone, whose raw instant differs), then by instant for
    // legacy rows that predate slotKey.
    let existing = slotKey
      ? await prisma.medicationDose.findFirst({ where: { medicationId: medId, slotKey } })
      : null;
    if (!existing) {
      existing = await prisma.medicationDose.findUnique({
        where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
      });
    }

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

    // New rows land on the slot's canonical instant so the unique index makes
    // the slot itself unique, whatever timezone the writer is in.
    const storedInstant = (!existing && canonicalInstantForSlot(slotKey)) || scheduledFor;

    const write = async () => prisma.$transaction(async (tx) => {
      // Update the row we already identified (by slotKey or instant) in place,
      // so a cross-timezone or re-timed log can never spawn a second row for
      // the slot; backfill slotKey onto a legacy row the first time it is
      // touched.
      const dose = existing
        ? await tx.medicationDose.update({
            where: { id: existing.id },
            data: { status, notes, givenAt, deletedAt: null, slotKey: existing.slotKey ?? slotKey },
          })
        : await tx.medicationDose.create({
            data: { medicationId: medId, scheduledFor: storedInstant, slotKey, status, notes, givenAt },
          });

      await applySupply(tx, medId, medication.quantityRemaining != null, delta);
      const updatedMed = await tx.petMedication.findUnique({
        where: { id: medId }, select: { quantityRemaining: true },
      });

      await audit(tx, {
        petId: id,
        medicationId: medId,
        doseId: dose.id,
        action: isRevival ? AUDIT_ACTIONS.DOSE_CHANGED : AUDIT_ACTIONS.DOSE_LOGGED,
        actorUserId: auth.user.id,
        snapshot: { before: existing || null, after: dose, supplyDelta: delta },
      });

      return { dose, quantityRemaining: updatedMed?.quantityRemaining ?? null };
    });

    let result;
    try {
      result = await write();
    } catch (err) {
      // The other caregiver won the race and inserted this slot between our
      // lookup and our insert. Their record stands; report it rather than
      // retrying into a second dose.
      if (err?.code === 'P2002') {
        const winner = await prisma.medicationDose.findFirst({
          where: { medicationId: medId, ...(slotKey ? { slotKey } : { scheduledFor: storedInstant }) },
        });
        if (winner) {
          return NextResponse.json({
            dose: winner,
            quantityRemaining: medication.quantityRemaining,
            alreadyLogged: true,
          });
        }
      }
      throw err;
    }

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
    const slotKey = searchParams.get('slotKey') || null;
    const scheduledForRaw = searchParams.get('scheduledFor');
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;
    const instantValid = scheduledFor && !Number.isNaN(scheduledFor.getTime());
    if (!slotKey && !instantValid) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
    }

    // Resolve the row the same way POST does, so an undo works from any
    // timezone (by slotKey), falling back to the raw instant for legacy rows.
    let existing = slotKey
      ? await prisma.medicationDose.findFirst({ where: { medicationId: medId, slotKey } })
      : null;
    if (!existing && instantValid) {
      existing = await prisma.medicationDose.findUnique({
        where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
      });
    }
    // Rows written since slots became canonical sit at the slot's UTC instant
    // rather than the caller's local one.
    if (!existing) {
      const canonical = canonicalInstantForSlot(slotKey);
      if (canonical) {
        existing = await prisma.medicationDose.findUnique({
          where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor: canonical } },
        });
      }
    }
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

      await applySupply(tx, medId, medication.quantityRemaining != null, delta);
      const updatedMed = await tx.petMedication.findUnique({
        where: { id: medId }, select: { quantityRemaining: true },
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
