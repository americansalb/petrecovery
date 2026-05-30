import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/volunteers/schedule
 * Get volunteer schedules for a squad or case
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const squadId = searchParams.get('squadId');
    const missionId = searchParams.get('missionId');
    const date = searchParams.get('date'); // YYYY-MM-DD
    const weekOf = searchParams.get('weekOf'); // Get full week

    const where = {};

    if (squadId) {
      where.squadId = squadId;
    }

    if (missionId) {
      where.missionId = missionId;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      where.startTime = { gte: startDate, lte: endDate };
    } else if (weekOf) {
      const start = new Date(weekOf);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      where.startTime = { gte: start, lt: end };
    }

    const shifts = await prisma.volunteerShift.findMany({
      where,
      include: {
        volunteer: {
          select: { id: true, firstName: true, lastName: true, profileImage: true },
        },
        case: {
          select: { id: true, petName: true, caseNumber: true },
        },
        squad: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by date
    const schedule = {};
    for (const shift of shifts) {
      const dateKey = shift.startTime.toISOString().split('T')[0];
      if (!schedule[dateKey]) {
        schedule[dateKey] = [];
      }
      schedule[dateKey].push(shift);
    }

    return NextResponse.json({ shifts, schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json({ error: 'Failed to get schedule' }, { status: 500 });
  }
}

/**
 * POST /api/volunteers/schedule
 * Create a new shift
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      squadId,
      missionId,
      startTime,
      endTime,
      title,
      description,
      location,
      maxVolunteers,
      requiredCertifications,
    } = await request.json();

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start and end time required' }, { status: 400 });
    }

    // Verify user is coordinator or leader
    if (squadId) {
      const membership = await prisma.rescueSquadMember.findFirst({
        where: {
          userId: session.user.id,
          rescueSquadId: squadId,
          role: { in: ['LEADER', 'COORDINATOR', 'FOUNDER'] },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: 'Must be rescue force leader/coordinator' }, { status: 403 });
      }
    }

    const shift = await prisma.volunteerShift.create({
      data: {
        squadId,
        missionId,
        createdById: session.user.id,
        title: title || 'Search Shift',
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        maxVolunteers: maxVolunteers || 10,
        requiredCertifications: requiredCertifications || [],
        status: 'OPEN',
      },
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
  }
}

/**
 * PUT /api/volunteers/schedule
 * Sign up for or update a shift
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftId, action } = await request.json();

    if (!shiftId || !action) {
      return NextResponse.json({ error: 'Shift ID and action required' }, { status: 400 });
    }

    const shift = await prisma.volunteerShift.findUnique({
      where: { id: shiftId },
      include: {
        signups: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    if (action === 'signup') {
      // Check if already signed up
      const existing = shift.signups.find(s => s.volunteerId === session.user.id);
      if (existing) {
        return NextResponse.json({ error: 'Already signed up' }, { status: 400 });
      }

      // Check capacity
      if (shift.signups.length >= shift.maxVolunteers) {
        return NextResponse.json({ error: 'Shift is full' }, { status: 400 });
      }

      // Check certifications
      if (shift.requiredCertifications?.length > 0) {
        const userCerts = await prisma.volunteerCertification.findMany({
          where: {
            userId: session.user.id,
            status: 'ACTIVE',
            type: { in: shift.requiredCertifications },
          },
        });

        const userCertTypes = userCerts.map(c => c.type);
        const missing = shift.requiredCertifications.filter(c => !userCertTypes.includes(c));

        if (missing.length > 0) {
          return NextResponse.json({
            error: 'Missing required certifications',
            missing,
          }, { status: 400 });
        }
      }

      await prisma.shiftSignup.create({
        data: {
          shiftId,
          volunteerId: session.user.id,
          status: 'CONFIRMED',
        },
      });

      return NextResponse.json({ success: true, action: 'signed_up' });
    }

    if (action === 'cancel') {
      await prisma.shiftSignup.deleteMany({
        where: {
          shiftId,
          volunteerId: session.user.id,
        },
      });

      return NextResponse.json({ success: true, action: 'cancelled' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 });
  }
}
