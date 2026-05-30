/**
 * Push Notification Send API
 * POST: Send push notifications to subscribers
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import webpush from 'web-push';
import { isAdmin, userHasCaseAuthority, userIsSquadLeader } from '@/app/lib/authz';

// Configure web-push with VAPID keys
// These should be in environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notifications@petrecovery.org';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      type,
      title,
      body,
      missionId,
      squadId,
      divisionId,
      targetUserIds,
      urgent = false,
      data = {},
    } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body required' },
        { status: 400 }
      );
    }

    // AUTHORIZATION: this endpoint can push to our trusted notification channel,
    // so the caller must be authorized for the chosen target scope. Otherwise any
    // logged-in user could phish every user via targetUserIds.
    let authorized = false;
    if (targetUserIds && targetUserIds.length > 0) {
      // Arbitrary fan-out to specific users → platform admins only.
      authorized = await isAdmin(session.user.id);
    } else if (squadId) {
      authorized = await userIsSquadLeader(session.user.id, squadId);
    } else if (missionId) {
      // mission routes use the caseId as the mission identifier.
      authorized = await userHasCaseAuthority(session.user.id, missionId);
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build the where clause for finding subscriptions
    let whereClause = {};

    if (targetUserIds && targetUserIds.length > 0) {
      // Send to specific users
      whereClause.userId = { in: targetUserIds };
    } else if (squadId) {
      // Send to all active squad members. (Model is RescueSquadMember — the
      // previous prisma.squadMembership doesn't exist and 500'd this path.)
      const members = await prisma.rescueSquadMember.findMany({
        where: {
          rescueSquadId: squadId,
          isActive: true,
          ...(divisionId ? { divisionId } : {}),
        },
        select: { userId: true },
      });
      whereClause.userId = { in: members.map(m => m.userId) };
    } else if (missionId) {
      // missionId is the CASE id. Resolve the case's MissionControl (caseId is
      // @unique) and notify its active volunteers via the activeVolunteers
      // relation. (Previously queried missionVolunteer by missionControlId =
      // caseId → always 0 rows; a second dead branch used a nonexistent
      // `volunteers` relation. Consolidated + corrected here.)
      const mission = await prisma.missionControl.findUnique({
        where: { caseId: missionId },
        include: {
          activeVolunteers: {
            where: { status: 'ACTIVE' },
            select: { userId: true },
          },
        },
      });
      const userIds = (mission?.activeVolunteers || [])
        .map(v => v.userId)
        .filter(Boolean);
      if (userIds.length === 0) {
        return NextResponse.json({ sent: 0, failed: 0 });
      }
      whereClause.userId = { in: userIds };
    }

    // Get subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: whereClause,
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0 });
    }

    // Get case info for notification data
    let caseInfo = null;
    if (missionId) {
      caseInfo = await prisma.case.findUnique({
        where: { id: missionId },
        select: { caseNumber: true, petName: true },
      });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/paw-192.png',
      badge: '/icons/badge-72.png',
      tag: type || 'general',
      data: {
        type,
        missionId,
        missionNumber: caseInfo?.caseNumber,
        squadId,
        missionId,
        urgent,
        timestamp: Date.now(),
        ...data,
      },
    });

    // Send notifications
    let sent = 0;
    let failed = 0;
    const failedEndpoints = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payload);
          sent++;
        } catch (err) {
          failed++;
          console.error('Push notification failed:', err.statusCode, err.message);

          // If subscription is invalid, mark for deletion
          if (err.statusCode === 404 || err.statusCode === 410) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: failedEndpoints } },
      });
    }

    return NextResponse.json({
      sent,
      failed,
      cleaned: failedEndpoints.length,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
