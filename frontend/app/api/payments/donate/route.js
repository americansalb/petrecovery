import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { createDonationSession } from '@/app/lib/payments/stripe';
import { getBaseUrl } from '@/app/lib/config';

/**
 * POST /api/payments/donate
 * Create a donation checkout session
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { amount, missionId, message } = await request.json();

    if (!amount || amount < 1) {
      return NextResponse.json({ error: 'Minimum donation is $1' }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: 'Maximum donation is $10,000' }, { status: 400 });
    }

    let caseName = null;
    if (missionId) {
      const missionData = await prisma.case.findUnique({
        where: { id: missionId },
        select: { petName: true },
      });
      caseName = missionData?.petName;
    }

    const baseUrl = getBaseUrl();
    const successUrl = `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/donate/cancel`;

    const checkoutSession = await createDonationSession({
      amount,
      missionId,
      caseName,
      donorEmail: session?.user?.email,
      successUrl,
      cancelUrl,
    });

    // Record donation intent
    await prisma.donation.create({
      data: {
        amount,
        missionId,
        donorId: session?.user?.id,
        stripeSessionId: checkoutSession.sessionId,
        message,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Donation error:', error);
    return NextResponse.json({ error: 'Failed to create donation' }, { status: 500 });
  }
}

/**
 * GET /api/payments/donate
 * Get donations for a case or user
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    const donations = await prisma.donation.findMany({
      where: {
        missionId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        amount: true,
        message: true,
        createdAt: true,
        donor: {
          select: { firstName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = donations.reduce((sum, d) => sum + d.amount, 0);

    return NextResponse.json({
      donations: donations.map(d => ({
        ...d,
        donorName: d.donor?.firstName || 'Anonymous',
      })),
      total,
      count: donations.length,
    });
  } catch (error) {
    console.error('Get donations error:', error);
    return NextResponse.json({ error: 'Failed to get donations' }, { status: 500 });
  }
}
