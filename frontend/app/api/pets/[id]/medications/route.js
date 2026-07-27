/**
 * Pet Medication API
 *
 * GET  /api/pets/[id]/medications - List a pet's medications (+ recent doses)
 * POST /api/pets/[id]/medications - Add a medication
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';
import { validateMedicationInput, parseMedication } from '@/app/lib/medicationValidation';
import { logEvent } from '@/lib/logging';
import { audit, AUDIT_ACTIONS } from '@/app/lib/medicationAudit';

// How far back we ship dose history to the client (week strip + history feed).
const DOSE_HISTORY_DAYS = 35;

// GET /api/pets/[id]/medications
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'VIEWER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const since = new Date(Date.now() - DOSE_HISTORY_DAYS * 86400000);
    const medications = await prisma.petMedication.findMany({
      where: { petId: id, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      include: {
        doses: {
          where: { scheduledFor: { gte: since }, deletedAt: null },
          orderBy: { scheduledFor: 'desc' },
          take: 400,
        },
      },
    });

    return NextResponse.json({
      pet: auth.pet,
      access: auth.access,
      medications: medications.map(parseMedication),
    });
  } catch (error) {
    console.error('[MEDS API] Error listing medications:', error);
    return NextResponse.json({ error: 'Failed to load medications' }, { status: 500 });
  }
}

// POST /api/pets/[id]/medications
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const { data, error } = validateMedicationInput(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const count = await prisma.petMedication.count({ where: { petId: id, deletedAt: null } });
    if (count >= 50) {
      return NextResponse.json({ error: 'Medication limit reached for this pet' }, { status: 400 });
    }

    const medication = await prisma.$transaction(async (tx) => {
      const created = await tx.petMedication.create({
        data: { ...data, petId: id },
        include: { doses: true },
      });
      await audit(tx, {
        petId: id,
        medicationId: created.id,
        action: AUDIT_ACTIONS.MED_CREATED,
        actorUserId: auth.user.id,
        snapshot: { after: created },
      });
      return created;
    });

    // Fire-and-forget: logging must never fail the request.
    logEvent({
      event_type: 'pet.medication_created',
      resource_type: 'pet_medication',
      resource_id: medication.id,
      action: 'create',
      result: 'success',
      actor_user_id: auth.user.id,
      metadata: { petId: id, name: medication.name },
    }).catch(() => {});

    return NextResponse.json(
      { medication: parseMedication(medication), message: `${medication.name} added` },
      { status: 201 }
    );
  } catch (error) {
    console.error('[MEDS API] Error creating medication:', error);
    return NextResponse.json({ error: 'Failed to add medication' }, { status: 500 });
  }
}
