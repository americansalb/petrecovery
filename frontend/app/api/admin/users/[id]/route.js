import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET - Get user details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        profile: true,
        rescueForceMemberships: {
          include: { rescueForce: { select: { id: true, name: true } } },
        },
        cases: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, caseNumber: true, petName: true, status: true },
        },
        _count: {
          select: {
            cases: true,
            caseParticipations: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove sensitive fields
    const { passwordHash, resetToken, ...safeUser } = user;

    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// PATCH - Update user
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const updates = await request.json();
    const allowedFields = ['role', 'rescueLevel', 'firstName', 'lastName'];

    const data = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        data[field] = updates[field];
      }
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        rescueLevel: true,
      },
    });

    // Log admin action
    await prisma.eventLog.create({
      data: {
        event_type: 'admin.user_updated',
        timestamp: new Date(),
        correlation_id: `admin-${Date.now()}`,
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        resource_type: 'user',
        resource_id: params.id,
        action: 'update',
        result: 'success',
        metadata: JSON.stringify({ updates: data }),
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE - Delete user (soft delete)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Don't allow deleting yourself
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Soft delete by anonymizing
    await prisma.user.update({
      where: { id: params.id },
      data: {
        email: `deleted-${params.id}@deleted.local`,
        firstName: 'Deleted',
        lastName: 'User',
        passwordHash: null,
        phone: null,
      },
    });

    // Log admin action
    await prisma.eventLog.create({
      data: {
        event_type: 'admin.user_deleted',
        timestamp: new Date(),
        correlation_id: `admin-${Date.now()}`,
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        resource_type: 'user',
        resource_id: params.id,
        action: 'delete',
        result: 'success',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
