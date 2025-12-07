import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import {
  createSubscriptionSession,
  cancelSubscription,
  getSubscription,
  SUBSCRIPTION_TIERS,
} from '@/app/lib/payments/stripe';

/**
 * GET /api/payments/subscription
 * Get subscription status and available tiers
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return available tiers
    if (action === 'tiers') {
      return NextResponse.json({ tiers: SUBSCRIPTION_TIERS });
    }

    // Get user's subscription
    if (!session?.user?.id) {
      return NextResponse.json({ subscription: null, tier: 'FREE' });
    }

    const userSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (!userSubscription) {
      return NextResponse.json({
        subscription: null,
        tier: 'FREE',
        features: SUBSCRIPTION_TIERS.FREE.features,
      });
    }

    // Get latest status from Stripe
    const stripeStatus = await getSubscription(userSubscription.stripeSubscriptionId);

    return NextResponse.json({
      subscription: {
        id: userSubscription.id,
        tier: userSubscription.tier,
        status: stripeStatus.status,
        currentPeriodEnd: stripeStatus.currentPeriodEnd,
        cancelAtPeriodEnd: stripeStatus.cancelAtPeriodEnd,
      },
      tier: userSubscription.tier,
      features: SUBSCRIPTION_TIERS[userSubscription.tier]?.features || [],
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}

/**
 * POST /api/payments/subscription
 * Create subscription checkout session
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier } = await request.json();

    if (!tier || !SUBSCRIPTION_TIERS[tier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    if (tier === 'FREE') {
      return NextResponse.json({ error: 'Cannot subscribe to free tier' }, { status: 400 });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];
    if (!tierConfig.priceId) {
      return NextResponse.json({ error: 'Tier not available' }, { status: 400 });
    }

    // Check if already subscribed
    const existing = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (existing) {
      return NextResponse.json({
        error: 'Already subscribed. Manage subscription in account settings.',
      }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/account/subscription?success=true`;
    const cancelUrl = `${baseUrl}/pricing`;

    const checkoutSession = await createSubscriptionSession({
      priceId: tierConfig.priceId,
      customerEmail: session.user.email,
      userId: session.user.id,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

/**
 * DELETE /api/payments/subscription
 * Cancel subscription
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (!userSubscription) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const result = await cancelSubscription(userSubscription.stripeSubscriptionId);

    if (result.success) {
      await prisma.subscription.update({
        where: { id: userSubscription.id },
        data: { status: 'canceled' },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription cancelled. You will have access until the end of your billing period.',
      });
    }

    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
