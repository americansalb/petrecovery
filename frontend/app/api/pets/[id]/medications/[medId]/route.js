/**
 * Single Medication API
 *
 * PATCH  /api/pets/[id]/medications/[medId] - Update (incl. pause/resume, customization)
 * DELETE /api/pets/[id]/medications/[medId] - Delete medication + dose history
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';
import { validateMedicationInput, parseMedication } from '@/app/lib/medicationValidation';
import { logEvent } from '@/lib/logging';
import { audit, AUDIT_ACTIONS } from '@/app/lib/medicationAudit';

async function findOwnedMedication(petId, medId) {
  const medication = await prisma.petMedication.findUnique({ where: { id: medId } });
  if (!medication || medication.petId !== petId || medication.deletedAt) return null;
  return medication;
}

// PATCH /api/pets/[id]/medications/[medId]
export async function PATCH(request, { params }) {
  try {
    const { id, medId } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await findOwnedMedication(id, medId);
    if (!existing) return NextResponse.json({ error: 'Medication not found' }, { status: 404 });

    const body = await request.json();
    const { data, error } = validateMedicationInput(body, { partial: true });
    if (error) return NextResponse.json({ error }, { status: 400 });

    const medication = await prisma.$transaction(async (tx) => {
      const updated = await tx.petMedication.update({
        where: { id: medId },
        data,
        include: {
          doses: {
            where: { scheduledFor: { gte: new Date(Date.now() - 35 * 86400000) }, deletedAt: null },
            orderBy: { scheduledFor: 'desc' },
            take: 400,
          },
        },
      });
      await audit(tx, {
        petId: id,
        medicationId: medId,
        action: AUDIT_ACTIONS.MED_UPDATED,
        actorUserId: auth.user.id,
        snapshot: { before: existing, after: { ...updated, doses: undefined }, changed: Object.keys(data) },
      });
      return updated;
    });

    return NextResponse.json({ medication: parseMedication(medication) });
  } catch (error) {
    console.error('[MEDS API] Error updating medication:', error);
    return NextResponse.json({ error: 'Failed to update medication' }, { status: 500 });
  }
}

// DELETE /api/pets/[id]/medications/[medId]
export async function DELETE(request, { params }) {
  try {
    const { id, medId } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await findOwnedMedication(id, medId);
    if (!existing) return NextResponse.json({ error: 'Medication not found' }, { status: 404 });

    // Tombstone, never a hard delete: the dose history underneath is
    // medical data and survives in full.
    await prisma.$transaction(async (tx) => {
      await tx.petMedication.update({
        where: { id: medId },
        data: { deletedAt: new Date(), isActive: false },
      });
      await audit(tx, {
        petId: id,
        medicationId: medId,
        action: AUDIT_ACTIONS.MED_DELETED,
        actorUserId: auth.user.id,
        snapshot: { before: existing },
      });
    });

    // Fire-and-forget: logging must never fail the request.
    logEvent({
      event_type: 'pet.medication_deleted',
      resource_type: 'pet_medication',
      resource_id: medId,
      action: 'delete',
      result: 'success',
      actor_user_id: auth.user.id,
      metadata: { petId: id, name: existing.name },
    }).catch(() => {});

    return NextResponse.json({ message: `${existing.name} deleted. Its dose history is preserved and recoverable.` });
  } catch (error) {
    console.error('[MEDS API] Error deleting medication:', error);
    return NextResponse.json({ error: 'Failed to delete medication' }, { status: 500 });
  }
}
