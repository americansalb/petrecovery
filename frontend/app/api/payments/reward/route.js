import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createRewardEscrow, captureEscrow, releaseEscrow } from '@/app/lib/payments/stripe';

/**
 * POST /api/payments/reward
 * Create reward escrow for a case
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, amount } = await request.json();

    if (!caseId || !amount) {
      return NextResponse.json({ error: 'Case ID and amount required' }, { status: 400 });
    }

    if (amount < 10) {
      return NextResponse.json({ error: 'Minimum reward is $10' }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: 'Maximum reward is $10,000' }, { status: 400 });
    }

    // Verify case ownership
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { reporterId: true, petName: true, status: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (caseData.reporterId !== session.user.id) {
      return NextResponse.json({ error: 'Only case owner can set reward' }, { status: 403 });
    }

    if (caseData.status === 'REUNITED') {
      return NextResponse.json({ error: 'Case already reunited' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/cases/${caseId}?reward=success`;
    const cancelUrl = `${baseUrl}/cases/${caseId}?reward=cancel`;

    const checkoutSession = await createRewardEscrow({
      amount,
      caseId,
      caseName: caseData.petName,
      ownerEmail: session.user.email,
      successUrl,
      cancelUrl,
    });

    // Record reward escrow
    await prisma.rewardEscrow.create({
      data: {
        caseId,
        ownerId: session.user.id,
        amount,
        stripeSessionId: checkoutSession.sessionId,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Reward escrow error:', error);
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}

/**
 * PUT /api/payments/reward
 * Capture or release reward escrow
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { escrowId, action, finderId } = await request.json();

    if (!escrowId || !action) {
      return NextResponse.json({ error: 'Escrow ID and action required' }, { status: 400 });
    }

    const escrow = await prisma.rewardEscrow.findUnique({
      where: { id: escrowId },
      include: {
        case: { select: { reporterId: true } },
      },
    });

    if (!escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
    }

    // Verify ownership
    if (escrow.case.reporterId !== session.user.id) {
      // Check if admin
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (escrow.status !== 'HELD') {
      return NextResponse.json({ error: 'Escrow not in held status' }, { status: 400 });
    }

    if (action === 'capture') {
      // Pet was found - capture funds
      if (!finderId) {
        return NextResponse.json({ error: 'Finder ID required' }, { status: 400 });
      }

      const result = await captureEscrow(escrow.stripePaymentIntentId);

      if (result.success) {
        await prisma.rewardEscrow.update({
          where: { id: escrowId },
          data: {
            status: 'CAPTURED',
            finderId,
            capturedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Reward captured. Ready for payout to finder.',
        });
      }
    }

    if (action === 'release') {
      // Case closed without finding - release funds back to owner
      const result = await releaseEscrow(escrow.stripePaymentIntentId);

      if (result.success) {
        await prisma.rewardEscrow.update({
          where: { id: escrowId },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Reward released back to owner.',
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Reward action error:', error);
    return NextResponse.json({ error: 'Failed to process reward' }, { status: 500 });
  }
}

/**
 * GET /api/payments/reward
 * Get reward info for a case
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    const escrow = await prisma.rewardEscrow.findFirst({
      where: {
        caseId,
        status: { in: ['HELD', 'CAPTURED'] },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    if (!escrow) {
      return NextResponse.json({ hasReward: false });
    }

    return NextResponse.json({
      hasReward: true,
      amount: escrow.amount,
      status: escrow.status,
    });
  } catch (error) {
    console.error('Get reward error:', error);
    return NextResponse.json({ error: 'Failed to get reward' }, { status: 500 });
  }
}
