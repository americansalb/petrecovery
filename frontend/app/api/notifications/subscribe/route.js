/**
 * Push Notification Subscription API
 * POST: Subscribe to push notifications
 * DELETE: Unsubscribe from push notifications
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { subscription, deviceId, deviceName, preferences, resubscribe } = await request.json();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription object required' },
        { status: 400 }
      );
    }

    // Create or update subscription
    const data = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
      deviceName: deviceName || 'Unknown Device',
      expirationTime: subscription.expirationTime,
      preferences: preferences || {
        sightings: true,
        missionAlerts: true,
        squadUpdates: true,
        broadcasts: true,
      },
      updatedAt: new Date(),
    };

    // If user is logged in, associate with user
    if (session?.user?.id) {
      data.userId = session.user.id;
    }

    // Find existing subscription by endpoint or deviceId
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        OR: [
          { endpoint: subscription.endpoint },
          deviceId ? { deviceId } : undefined,
        ].filter(Boolean),
      },
    });

    let sub;
    if (existing) {
      sub = await prisma.pushSubscription.update({
        where: { id: existing.id },
        data,
      });
    } else {
      sub = await prisma.pushSubscription.create({
        data: {
          ...data,
          deviceId: deviceId || `device_${Math.random().toString(36).substring(2, 15)}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      deviceId: sub.deviceId,
    });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { endpoint, deviceId } = await request.json();

    if (!endpoint && !deviceId) {
      return NextResponse.json(
        { error: 'Endpoint or deviceId required' },
        { status: 400 }
      );
    }

    // Delete the subscription
    await prisma.pushSubscription.deleteMany({
      where: {
        OR: [
          endpoint ? { endpoint } : undefined,
          deviceId ? { deviceId } : undefined,
        ].filter(Boolean),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
