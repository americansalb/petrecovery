/**
 * Admin Shelter Approval API
 *
 * POST /api/admin/shelters/approve - Approve or reject a shelter request
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';

export async function POST(request) {
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

    const body = await request.json();
    const { claimId, action, reviewNotes } = body;

    if (!claimId || !action) {
      return NextResponse.json(
        { error: 'Claim ID and action are required' },
        { status: 400 }
      );
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    // Get the claim
    const claim = await prisma.shelterClaim.findUnique({
      where: { id: claimId }
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (claim.status === 'APPROVED' || claim.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'This claim has already been processed' },
        { status: 400 }
      );
    }

    // Get the shelter and claimant
    const [shelter, claimant] = await Promise.all([
      prisma.shelter.findUnique({ where: { id: claim.shelterId } }),
      prisma.user.findUnique({ where: { id: claim.claimantId } }),
    ]);

    if (action === 'APPROVE') {
      // Update claim status
      await prisma.shelterClaim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          reviewNotes,
        }
      });

      // Activate the shelter
      await prisma.shelter.update({
        where: { id: claim.shelterId },
        data: {
          isActive: true,
          isVerified: true,
        }
      });

      // Create or update shelter profile
      await prisma.shelterProfile.upsert({
        where: { shelterId: claim.shelterId },
        update: {
          claimedById: claim.claimantId,
          claimedAt: new Date(),
        },
        create: {
          shelterId: claim.shelterId,
          claimedById: claim.claimantId,
          claimedAt: new Date(),
        }
      });

      // Send approval email
      if (claimant?.email) {
        await sendEmail({
          to: claimant.email,
          subject: `Your shelter account has been approved - ${shelter?.name}`,
          html: `
            <h2>Welcome to ReunitePets!</h2>
            <p>Hi ${claimant.firstName},</p>
            <p>Great news! Your request to manage <strong>${shelter?.name}</strong> has been approved.</p>
            <p>You can now access your shelter dashboard to:</p>
            <ul>
              <li>Add and manage animals</li>
              <li>Update your shelter profile</li>
              <li>Accept donations</li>
              <li>Connect with lost pet owners</li>
            </ul>
            <p><a href="${process.env.NEXTAUTH_URL}/shelter/dashboard">Go to your dashboard</a></p>
            <p>Thank you for helping reunite pets with their families!</p>
          `,
        }).catch(err => console.error('Failed to send approval email:', err));
      }

      return NextResponse.json({
        success: true,
        message: 'Shelter request approved',
        shelter: {
          id: shelter?.id,
          name: shelter?.name,
        },
      });
    } else {
      // REJECT
      await prisma.shelterClaim.update({
        where: { id: claimId },
        data: {
          status: 'REJECTED',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          reviewNotes,
        }
      });

      // Send rejection email
      if (claimant?.email) {
        await sendEmail({
          to: claimant.email,
          subject: `Update on your shelter request - ${shelter?.name}`,
          html: `
            <h2>Shelter Request Update</h2>
            <p>Hi ${claimant.firstName},</p>
            <p>Thank you for your interest in joining ReunitePets with <strong>${shelter?.name}</strong>.</p>
            <p>Unfortunately, we were unable to approve your request at this time.</p>
            ${reviewNotes ? `<p><strong>Reason:</strong> ${reviewNotes}</p>` : ''}
            <p>If you believe this was a mistake or have additional information to provide, please contact us.</p>
          `,
        }).catch(err => console.error('Failed to send rejection email:', err));
      }

      return NextResponse.json({
        success: true,
        message: 'Shelter request rejected',
      });
    }
  } catch (error) {
    console.error('Error processing shelter request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
