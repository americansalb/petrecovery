import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// Available certification types
const CERTIFICATION_TYPES = {
  BASIC_SEARCH: {
    name: 'Basic Search Volunteer',
    description: 'Completed basic search volunteer training',
    validityMonths: 12,
    requiresApproval: false,
  },
  ADVANCED_SEARCH: {
    name: 'Advanced Search Techniques',
    description: 'Certified in advanced pet search methods',
    validityMonths: 12,
    requiresApproval: true,
  },
  FIRST_AID_PET: {
    name: 'Pet First Aid',
    description: 'Certified in pet first aid and basic care',
    validityMonths: 24,
    requiresApproval: true,
  },
  TRAP_HANDLING: {
    name: 'Humane Trap Handling',
    description: 'Certified to set and monitor humane traps',
    validityMonths: 12,
    requiresApproval: true,
  },
  DRONE_OPERATOR: {
    name: 'Drone Operator',
    description: 'FAA Part 107 certified drone pilot',
    validityMonths: 24,
    requiresApproval: true,
  },
  TRACKING_DOG_HANDLER: {
    name: 'Tracking Dog Handler',
    description: 'Certified tracking dog handler',
    validityMonths: 12,
    requiresApproval: true,
  },
  NIGHT_SEARCH: {
    name: 'Night Search Certified',
    description: 'Trained for safe nighttime searches',
    validityMonths: 12,
    requiresApproval: true,
  },
  SQUAD_LEADER: {
    name: 'Squad Leader',
    description: 'Certified to lead search squads',
    validityMonths: 12,
    requiresApproval: true,
  },
};

/**
 * GET /api/volunteers/certifications
 * Get certifications for a user or list available types
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listTypes = searchParams.get('types') === 'true';

    if (listTypes) {
      return NextResponse.json({ types: CERTIFICATION_TYPES });
    }

    const targetUserId = userId || session?.user?.id;
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const certifications = await prisma.volunteerCertification.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    });

    // Add type details
    const enriched = certifications.map(cert => ({
      ...cert,
      typeName: CERTIFICATION_TYPES[cert.type]?.name || cert.type,
      typeDescription: CERTIFICATION_TYPES[cert.type]?.description,
      isExpired: cert.expiresAt && new Date(cert.expiresAt) < new Date(),
      isExpiringSoon: cert.expiresAt &&
        new Date(cert.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));

    return NextResponse.json({ certifications: enriched });
  } catch (error) {
    console.error('Get certifications error:', error);
    return NextResponse.json({ error: 'Failed to get certifications' }, { status: 500 });
  }
}

/**
 * POST /api/volunteers/certifications
 * Apply for or grant a certification
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, userId, documentUrl, notes } = await request.json();

    if (!type) {
      return NextResponse.json({ error: 'Certification type required' }, { status: 400 });
    }

    const certType = CERTIFICATION_TYPES[type];
    if (!certType) {
      return NextResponse.json({ error: 'Invalid certification type' }, { status: 400 });
    }

    const targetUserId = userId || session.user.id;

    // Check if granting to another user (admin only)
    if (userId && userId !== session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Cannot grant certifications to others' }, { status: 403 });
      }
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + certType.validityMonths);

    // Determine initial status
    const status = certType.requiresApproval && !userId
      ? 'PENDING'
      : 'ACTIVE';

    const certification = await prisma.volunteerCertification.create({
      data: {
        userId: targetUserId,
        type,
        status,
        issuedAt: status === 'ACTIVE' ? new Date() : null,
        expiresAt: status === 'ACTIVE' ? expiresAt : null,
        documentUrl,
        notes,
        issuedById: status === 'ACTIVE' ? session.user.id : null,
      },
    });

    return NextResponse.json({
      certification,
      message: status === 'PENDING'
        ? 'Certification application submitted for review'
        : 'Certification granted',
    }, { status: 201 });
  } catch (error) {
    console.error('Create certification error:', error);
    return NextResponse.json({ error: 'Failed to create certification' }, { status: 500 });
  }
}

/**
 * PUT /api/volunteers/certifications
 * Approve/reject certification application
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { certificationId, action, reason } = await request.json();

    if (!certificationId || !action) {
      return NextResponse.json({ error: 'Certification ID and action required' }, { status: 400 });
    }

    const cert = await prisma.volunteerCertification.findUnique({
      where: { id: certificationId },
    });

    if (!cert) {
      return NextResponse.json({ error: 'Certification not found' }, { status: 404 });
    }

    if (cert.status !== 'PENDING') {
      return NextResponse.json({ error: 'Certification not pending' }, { status: 400 });
    }

    if (action === 'approve') {
      const certType = CERTIFICATION_TYPES[cert.type];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + (certType?.validityMonths || 12));

      await prisma.volunteerCertification.update({
        where: { id: certificationId },
        data: {
          status: 'ACTIVE',
          issuedAt: new Date(),
          expiresAt,
          issuedById: session.user.id,
        },
      });

      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'reject') {
      await prisma.volunteerCertification.update({
        where: { id: certificationId },
        data: {
          status: 'REJECTED',
          notes: reason || 'Application rejected',
        },
      });

      return NextResponse.json({ success: true, action: 'rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update certification error:', error);
    return NextResponse.json({ error: 'Failed to update certification' }, { status: 500 });
  }
}
