/**
 * GET /api/pets/[id]/medications/export
 *
 * Full medication backup as a downloadable JSON file: every medication
 * (including deleted ones), every dose ever logged (including voided), and
 * for owners the complete audit journal. This is the user-held copy of the
 * data, independent of our database.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { requirePetAccess } from '@/app/lib/petOwnership';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetAccess(id, 'VIEWER');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const medications = await prisma.petMedication.findMany({
      where: { petId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        doses: { orderBy: { scheduledFor: 'asc' } },
      },
    });

    // The journal contains actor ids and full change history; owner only.
    const auditLog = auth.access === 'OWNER'
      ? await prisma.medicationAuditLog.findMany({
          where: { petId: id },
          orderBy: { createdAt: 'asc' },
        })
      : undefined;

    const backup = {
      format: 'reunitepets.medications.backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      pet: { id: auth.pet.id, name: auth.pet.name, species: auth.pet.species },
      medications: medications.map((m) => ({
        ...m,
        timesOfDay: JSON.parse(m.timesOfDay || '[]'),
        daysOfWeek: m.daysOfWeek ? JSON.parse(m.daysOfWeek) : null,
      })),
      ...(auditLog ? { auditLog: auditLog.map((a) => ({ ...a, snapshot: JSON.parse(a.snapshot) })) } : {}),
    };

    const filename = `${auth.pet.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-medications-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[MEDS EXPORT] Error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
