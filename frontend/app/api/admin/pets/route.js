/**
 * Admin Pets API
 *
 * GET /api/admin/pets - List all pets (admin only)
 * DELETE /api/admin/pets - Bulk delete pets (admin only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/pets - List all pets
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const pets = await prisma.pet.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        cases: {
          select: {
            id: true,
            caseNumber: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return NextResponse.json({
      pets: pets.map(pet => ({
        ...pet,
        photos: JSON.parse(pet.photos || '[]'),
        personality: JSON.parse(pet.personality || '[]'),
      }))
    });
  } catch (error) {
    console.error('[ADMIN PETS] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pets' }, { status: 500 });
  }
}

// DELETE /api/admin/pets - Bulk delete pets
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { ids, all } = body;

    if (all === true) {
      // Delete all pets (soft delete)
      const result = await prisma.pet.updateMany({
        where: { isDeleted: false },
        data: { isDeleted: true, deletedAt: new Date() }
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No pet IDs provided' }, { status: 400 });
    }

    // First close any active cases for these pets
    await prisma.case.updateMany({
      where: {
        petId: { in: ids },
        status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] }
      },
      data: {
        status: 'CLOSED_OTHER',
        resolution: 'SEARCH_CEASED',
        resolutionNotes: 'Closed by admin when deleting pet',
        resolvedAt: new Date(),
      }
    });

    // Soft delete the pets
    const result = await prisma.pet.updateMany({
      where: { id: { in: ids } },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('[ADMIN PETS] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete pets' }, { status: 500 });
  }
}
