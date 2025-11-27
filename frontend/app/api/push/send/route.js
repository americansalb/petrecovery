import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { sendPushNotification, sendPushToMany, PUSH_TEMPLATES } from '@/app/lib/push';

/**
 * POST /api/push/send
 *
 * Send push notifications to users.
 * Admin-only or system use.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Only admins or authenticated system calls can send push
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userIds, template, templateData, payload, caseId } = body;

    if (!userIds || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs are required' },
        { status: 400 }
      );
    }

    // Build notification payload
    let notificationPayload;
    if (template && PUSH_TEMPLATES[template]) {
      const templateValues = Array.isArray(templateData) ? templateData : [templateData];
      notificationPayload = PUSH_TEMPLATES[template](...templateValues);
    } else if (payload) {
      notificationPayload = payload;
    } else {
      return NextResponse.json(
        { error: 'Payload or template is required' },
        { status: 400 }
      );
    }

    // Get active subscriptions for users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscriptions found',
        sent: 0,
        failed: 0,
      });
    }

    // Format subscriptions for sending
    const formattedSubs = subscriptions.map((sub) => ({
      id: sub.id,
      subscription: JSON.parse(sub.subscription),
    }));

    // Send notifications
    const result = await sendPushToMany(formattedSubs, notificationPayload);

    // Log the push notification
    await prisma.pushNotificationLog.create({
      data: {
        caseId: caseId || null,
        template: template || null,
        payload: JSON.stringify(notificationPayload),
        recipientCount: subscriptions.length,
        sentCount: result.sent,
        failedCount: result.failed,
      },
    });

    // Mark expired subscriptions as inactive
    if (result.expired.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: result.expired } },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      expired: result.expired.length,
    });
  } catch (error) {
    console.error('Push send error:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
