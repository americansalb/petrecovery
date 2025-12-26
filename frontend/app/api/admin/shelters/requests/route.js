/**
 * Admin Shelter Requests API
 *
 * GET /api/admin/shelters/requests - List pending shelter requests
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'pending'; // pending, approved, rejected, all

    // Build where clause
    let claimsWhere = {};
    if (filter === 'pending') {
      claimsWhere = {
        status: { in: ['PENDING', 'VERIFICATION_SENT', 'UNDER_REVIEW'] }
      };
    } else if (filter === 'approved') {
      claimsWhere = { status: 'APPROVED' };
    } else if (filter === 'rejected') {
      claimsWhere = { status: 'REJECTED' };
    }

    const claims = await prisma.shelterClaim.findMany({
      where: claimsWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get shelter and claimant info for each claim
    const claimsWithDetails = await Promise.all(
      claims.map(async (claim) => {
        const [shelter, claimant] = await Promise.all([
          prisma.shelter.findUnique({
            where: { id: claim.shelterId },
            select: { id: true, name: true, city: true, state: true, email: true, phone: true, type: true }
          }),
          prisma.user.findUnique({
            where: { id: claim.claimantId },
            select: { id: true, firstName: true, lastName: true, email: true }
          }),
        ]);

        let verificationData = {};
        try {
          verificationData = JSON.parse(claim.verificationData || '{}');
        } catch (e) {}

        return {
          ...claim,
          shelter,
          claimant,
          verificationData,
        };
      })
    );

    // Get stats
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.shelterClaim.count({
        where: { status: { in: ['PENDING', 'VERIFICATION_SENT', 'UNDER_REVIEW'] } }
      }),
      prisma.shelterClaim.count({ where: { status: 'APPROVED' } }),
      prisma.shelterClaim.count({ where: { status: 'REJECTED' } }),
    ]);

    return NextResponse.json({
      success: true,
      claims: claimsWithDetails,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching shelter requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
