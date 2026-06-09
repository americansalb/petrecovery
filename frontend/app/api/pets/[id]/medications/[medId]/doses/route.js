/**
 * Dose Log API
 *
 * POST   /api/pets/[id]/medications/[medId]/doses - Mark a slot given/skipped
 *        Body: { scheduledFor: ISO, status: 'GIVEN'|'SKIPPED', notes?, givenAt? }
 *        Upserts on (medicationId, scheduledFor) so re-tapping a slot updates it.
 * DELETE /api/pets/[id]/medications/[medId]/doses?scheduledFor=ISO - Undo a log
 *
 * Supply tracking: quantityRemaining decrements when a dose becomes GIVEN and
 * is restored when a GIVEN log is undone or flipped to SKIPPED.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';

async function findOwnedMedication(petId, medId) {
  const medication = await prisma.petMedication.findUnique({ where: { id: medId } });
  if (!medication || medication.petId !== petId) return null;
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
    // Keep logs near the present — blocks accidental far-future check-offs.
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

    const delta = supplyDelta(existing?.status ?? null, status);

    const [dose, updatedMed] = await prisma.$transaction([
      prisma.medicationDose.upsert({
        where: { medicationId_scheduledFor: { medicationId: medId, scheduledFor } },
        update: { status, notes, givenAt },
        create: { medicationId: medId, scheduledFor, status, notes, givenAt },
      }),
      prisma.petMedication.update({
        where: { id: medId },
        data:
          medication.quantityRemaining != null && delta !== 0
            ? { quantityRemaining: Math.max(0, medication.quantityRemaining + delta) }
            : {},
      }),
    ]);

    return NextResponse.json({
      dose,
      quantityRemaining: updatedMed.quantityRemaining,
    }, { status: existing ? 200 : 201 });
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
    if (!existing) return NextResponse.json({ error: 'No log for that slot' }, { status: 404 });

    const delta = supplyDelta(existing.status, null);

    const [, updatedMed] = await prisma.$transaction([
      prisma.medicationDose.delete({ where: { id: existing.id } }),
      prisma.petMedication.update({
        where: { id: medId },
        data:
          medication.quantityRemaining != null && delta !== 0
            ? { quantityRemaining: Math.max(0, medication.quantityRemaining + delta) }
            : {},
      }),
    ]);

    return NextResponse.json({ message: 'Undone', quantityRemaining: updatedMed.quantityRemaining });
  } catch (error) {
    console.error('[MEDS API] Error undoing dose:', error);
    return NextResponse.json({ error: 'Failed to undo dose' }, { status: 500 });
  }
}
