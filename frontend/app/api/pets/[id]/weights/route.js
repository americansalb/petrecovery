/**
 * Health Book: weight log
 *
 * GET    /api/pets/[id]/weights - history, oldest first (chart-ready)
 * POST   /api/pets/[id]/weights - one number, one tap
 * DELETE /api/pets/[id]/weights?entryId= - tombstone an entry
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'VIEWER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const weights = await prisma.petWeightEntry.findMany({
      where: { petId: id, deletedAt: null },
      orderBy: { recordedAt: 'asc' },
      take: 200,
    });
    return NextResponse.json({ access: auth.access, weights });
  } catch (error) {
    console.error('[WEIGHTS API] list failed:', error);
    return NextResponse.json({ error: 'Failed to load weights' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const weightLbs = parseFloat(body.weightLbs);
    if (isNaN(weightLbs) || weightLbs <= 0 || weightLbs > 500) {
      return NextResponse.json({ error: 'Weight should be a number of pounds' }, { status: 400 });
    }
    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
    if (isNaN(recordedAt.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    // The headline weight follows the newest entry, so a future-dated one would
    // hijack it (and stretch the chart into the future) until real time catches
    // up. Allow a day of clock skew, no more.
    if (recordedAt.getTime() > Date.now() + 86400000) {
      return NextResponse.json({ error: "A weight can't be logged for a future date" }, { status: 400 });
    }
    const note = (body.note || '').trim().slice(0, 200) || null;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.petWeightEntry.create({
        data: { petId: id, weightLbs, recordedAt, note },
      });
      // The profile's headline weight follows the newest entry
      const newest = await tx.petWeightEntry.findFirst({
        where: { petId: id, deletedAt: null },
        orderBy: { recordedAt: 'desc' },
      });
      if (newest) {
        await tx.pet.update({ where: { id }, data: { weight: newest.weightLbs } });
      }
      return created;
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('[WEIGHTS API] create failed:', error);
    return NextResponse.json({ error: 'Failed to log weight' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'CAREGIVER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const entryId = new URL(request.url).searchParams.get('entryId');
    if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 });

    const existing = await prisma.petWeightEntry.findFirst({
      where: { id: entryId, petId: id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // The profile's headline weight follows the newest entry, so deleting the
    // newest one must fall back to the next newest (or clear when none remain).
    // Without this, the profile keeps showing the weight just deleted.
    const entry = await prisma.$transaction(async (tx) => {
      await tx.petWeightEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
      const newest = await tx.petWeightEntry.findFirst({
        where: { petId: id, deletedAt: null },
        orderBy: { recordedAt: 'desc' },
      });
      await tx.pet.update({ where: { id }, data: { weight: newest ? newest.weightLbs : null } });
      return newest;
    });
    return NextResponse.json({ ok: true, weight: entry ? entry.weightLbs : null });
  } catch (error) {
    console.error('[WEIGHTS API] delete failed:', error);
    return NextResponse.json({ error: 'Failed to remove entry' }, { status: 500 });
  }
}
