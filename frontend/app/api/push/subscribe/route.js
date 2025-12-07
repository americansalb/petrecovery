import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getVapidPublicKey } from '@/app/lib/push';

/**
 * GET /api/push/subscribe
 *
 * Get VAPID public key for client-side subscription.
 */
export async function GET(request) {
  const vapidKey = getVapidPublicKey();

  if (!vapidKey) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    );
  }

  return NextResponse.json({ vapidPublicKey: vapidKey });
}

/**
 * POST /api/push/subscribe
 *
 * Save a new push subscription.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subscription, deviceName, browserInfo } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription' },
        { status: 400 }
      );
    }

    // Check if this endpoint already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      // Update existing subscription
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId: session.user.id,
          subscription: JSON.stringify(subscription),
          deviceName: deviceName || existing.deviceName,
          browserInfo: browserInfo || existing.browserInfo,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription updated',
        subscriptionId: existing.id,
      });
    }

    // Create new subscription
    const newSubscription = await prisma.pushSubscription.create({
      data: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        subscription: JSON.stringify(subscription),
        deviceName: deviceName || 'Unknown Device',
        browserInfo: browserInfo || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription saved',
      subscriptionId: newSubscription.id,
    });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push/subscribe
 *
 * Remove a push subscription.
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const subscriptionId = searchParams.get('id');

    if (!endpoint && !subscriptionId) {
      return NextResponse.json(
        { error: 'Endpoint or subscription ID required' },
        { status: 400 }
      );
    }

    const where = subscriptionId
      ? { id: subscriptionId, userId: session.user.id }
      : { endpoint, userId: session.user.id };

    await prisma.pushSubscription.deleteMany({ where });

    return NextResponse.json({
      success: true,
      message: 'Subscription removed',
    });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
