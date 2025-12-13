import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * DELETE /api/admin/shelters/[id]
 *
 * Delete a shelter from the database.
 * Admin only.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = params;

    // Soft delete by setting isActive to false
    await prisma.shelter.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete shelter error:', error);
    return NextResponse.json(
      { error: 'Failed to delete shelter', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/shelters/[id]
 *
 * Get a single shelter's details.
 * Admin only.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = params;

    const shelter = await prisma.shelter.findUnique({
      where: { id },
    });

    if (!shelter) {
      return NextResponse.json({ error: 'Shelter not found' }, { status: 404 });
    }

    return NextResponse.json({ shelter });
  } catch (error) {
    console.error('Get shelter error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shelter', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/shelters/[id]
 *
 * Update a shelter's details.
 * Admin only.
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ['name', 'phone', 'email', 'website', 'hours', 'address', 'type', 'isActive'];
    const updateData = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const shelter = await prisma.shelter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ shelter });
  } catch (error) {
    console.error('Update shelter error:', error);
    return NextResponse.json(
      { error: 'Failed to update shelter', details: error.message },
      { status: 500 }
    );
  }
}
