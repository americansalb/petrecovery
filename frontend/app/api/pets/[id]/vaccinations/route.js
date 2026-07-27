/**
 * Health Book: vaccinations
 *
 * GET  /api/pets/[id]/vaccinations  - list (any shared access)
 * POST /api/pets/[id]/vaccinations  - add a stamp (caregiver+)
 *
 * Same access rails as medications. Names are validated short labels
 * so the clinical face and stamps stay parseable.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9\s\/+'().-]{1,39}$/;

function validate(body) {
  const name = (body.name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) return { error: 'Vaccine name should be 2 to 40 plain characters' };
  const administeredAt = new Date(body.administeredAt);
  if (isNaN(administeredAt)) return { error: 'A valid given-on date is required' };
  let expiresAt = null;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (isNaN(expiresAt)) return { error: 'Expiry date is invalid' };
    if (expiresAt <= administeredAt) return { error: 'Expiry must be after the given-on date' };
  }
  const vetName = (body.vetName || '').trim().slice(0, 80) || null;
  const notes = (body.notes || '').trim().slice(0, 500) || null;
  return { data: { name, administeredAt, expiresAt, vetName, notes } };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'VIEWER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const vaccinations = await prisma.petVaccination.findMany({
      where: { petId: id, deletedAt: null },
      orderBy: [{ administeredAt: 'desc' }],
    });
    return NextResponse.json({ access: auth.access, vaccinations });
  } catch (error) {
    console.error('[VAX API] list failed:', error);
    return NextResponse.json({ error: 'Failed to load vaccinations' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const { data, error } = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const count = await prisma.petVaccination.count({ where: { petId: id, deletedAt: null } });
    if (count >= 100) {
      return NextResponse.json({ error: 'Vaccination limit reached for this pet' }, { status: 400 });
    }

    // A renewal retires the previous record of the same vaccine: adding the
    // Bordetella booster must clear the old "due/expired" row, not sit next
    // to it forever. Only records given on or before the new date are
    // retired, and they are tombstoned (never hard-deleted), same as DELETE.
    const replaced = await prisma.petVaccination.findMany({
      where: {
        petId: id,
        deletedAt: null,
        name: { equals: data.name, mode: 'insensitive' },
        administeredAt: { lte: data.administeredAt },
      },
      select: { id: true },
    });
    const retired = replaced.map((r) => r.id);

    const vaccination = await prisma.$transaction(async (tx) => {
      if (retired.length) {
        await tx.petVaccination.updateMany({
          where: { id: { in: retired } },
          data: { deletedAt: new Date() },
        });
      }
      return tx.petVaccination.create({ data: { ...data, petId: id } });
    });
    return NextResponse.json({ vaccination, retired }, { status: 201 });
  } catch (error) {
    console.error('[VAX API] create failed:', error);
    return NextResponse.json({ error: 'Failed to add vaccination' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const vaccinationId = new URL(request.url).searchParams.get('vaccinationId');
    if (!vaccinationId) return NextResponse.json({ error: 'vaccinationId is required' }, { status: 400 });

    const existing = await prisma.petVaccination.findFirst({
      where: { id: vaccinationId, petId: id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Tombstone: medical data is never hard-deleted
    await prisma.petVaccination.update({
      where: { id: vaccinationId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[VAX API] delete failed:', error);
    return NextResponse.json({ error: 'Failed to remove vaccination' }, { status: 500 });
  }
}
