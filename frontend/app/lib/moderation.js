/**
 * Content Moderation Service
 *
 * Handles content moderation, spam detection, and user reports
 */

import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications';

// Banned words/phrases for content filtering
const BANNED_PATTERNS = [
  /\b(spam|scam|fraud)\b/i,
  /\d{10,}/, // Long number sequences (phone spam)
  /(\$\d+|\bfree money\b)/i, // Money scams
];

// Suspicious patterns that trigger review
const SUSPICIOUS_PATTERNS = [
  /\bclick here\b/i,
  /\bact now\b/i,
  /\blimited time\b/i,
  /https?:\/\/[^\s]{50,}/i, // Very long URLs
];

/**
 * Check content for spam/inappropriate content
 */
export function analyzeContent(content) {
  if (!content) return { approved: true, flags: [] };

  const flags = [];
  const contentLower = content.toLowerCase();

  // Check for banned patterns
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(content)) {
      flags.push({ type: 'banned_content', severity: 'high', pattern: pattern.source });
    }
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      flags.push({ type: 'suspicious_content', severity: 'medium', pattern: pattern.source });
    }
  }

  // Check for excessive caps (shouting)
  const caps = content.replace(/[^A-Z]/g, '').length;
  const total = content.replace(/\s/g, '').length;
  if (total > 20 && caps / total > 0.7) {
    flags.push({ type: 'excessive_caps', severity: 'low' });
  }

  // Check for excessive repetition
  if (/(.)\1{4,}/.test(content)) {
    flags.push({ type: 'repetitive_chars', severity: 'low' });
  }

  const hasHighSeverity = flags.some((f) => f.severity === 'high');
  const hasMediumSeverity = flags.some((f) => f.severity === 'medium');

  return {
    approved: !hasHighSeverity,
    needsReview: hasMediumSeverity,
    flags,
  };
}

/**
 * Report content for moderation
 */
export async function reportContent({
  reporterId,
  contentType, // 'post', 'comment', 'message', 'mission'
  contentId,
  reason,
  details,
}) {
  // Create moderation report
  const report = await prisma.eventLog.create({
    data: {
      event_type: 'moderation.report',
      timestamp: new Date(),
      correlation_id: `report-${Date.now()}`,
      actor_user_id: reporterId,
      resource_type: contentType,
      resource_id: contentId,
      action: 'report',
      result: 'pending',
      metadata: JSON.stringify({
        reason,
        details,
        reportedAt: new Date().toISOString(),
      }),
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  for (const admin of admins) {
    await createInAppNotification({
      userId: admin.id,
      type: 'SYSTEM',
      title: 'New Content Report',
      message: `A ${contentType} has been reported for: ${reason}`,
      actionUrl: `/admin/moderation/${report.id}`,
    });
  }

  return report;
}

/**
 * Take moderation action
 */
export async function moderateContent({
  moderatorId,
  contentType,
  contentId,
  action, // 'approve', 'remove', 'warn', 'ban'
  reason,
}) {
  let result = { success: false };

  switch (action) {
    case 'approve':
      result = { success: true, action: 'approved' };
      break;

    case 'remove':
      result = await removeContent(contentType, contentId);
      break;

    case 'warn':
      result = await warnUser(contentType, contentId, reason);
      break;

    case 'ban':
      result = await banUser(contentType, contentId, reason);
      break;
  }

  // Log moderation action
  await prisma.eventLog.create({
    data: {
      event_type: 'moderation.action',
      timestamp: new Date(),
      correlation_id: `mod-${Date.now()}`,
      actor_user_id: moderatorId,
      actor_role: 'MODERATOR',
      resource_type: contentType,
      resource_id: contentId,
      action,
      result: result.success ? 'success' : 'failure',
      metadata: JSON.stringify({ reason, ...result }),
    },
  });

  return result;
}

/**
 * Remove content
 */
async function removeContent(contentType, contentId) {
  try {
    switch (contentType) {
      case 'post':
        await prisma.communityPost.update({
          where: { id: contentId },
          data: { isDeleted: true, deletedAt: new Date() },
        });
        break;

      case 'message':
        // Messages are typically not deleted but could be marked
        break;

      case 'mission':
        await prisma.case.update({
          where: { id: contentId },
          data: { status: 'CLOSED_OTHER' },
        });
        break;
    }

    return { success: true, action: 'removed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Warn a user
 */
async function warnUser(contentType, contentId, reason) {
  try {
    // Get the user who created the content
    let userId;
    switch (contentType) {
      case 'post':
        const post = await prisma.communityPost.findUnique({
          where: { id: contentId },
          select: { authorId: true },
        });
        userId = post?.authorId;
        break;

      case 'mission':
        const missionData = await prisma.case.findUnique({
          where: { id: contentId },
          select: { reporterId: true },
        });
        userId = missionData?.reporterId;
        break;
    }

    if (userId) {
      await createInAppNotification({
        userId,
        type: 'SYSTEM',
        title: 'Warning: Community Guidelines',
        message: `Your content has been flagged. Reason: ${reason}. Please review our community guidelines.`,
      });

      return { success: true, action: 'warned', userId };
    }

    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Ban a user
 */
async function banUser(contentType, contentId, reason) {
  try {
    let userId;
    switch (contentType) {
      case 'post':
        const post = await prisma.communityPost.findUnique({
          where: { id: contentId },
          select: { authorId: true },
        });
        userId = post?.authorId;
        break;

      case 'mission':
        const missionData = await prisma.case.findUnique({
          where: { id: contentId },
          select: { reporterId: true },
        });
        userId = missionData?.reporterId;
        break;
    }

    if (userId) {
      // Update user role to banned (or create a banned status)
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'USER' }, // In production, use a separate banned status
      });

      await createInAppNotification({
        userId,
        type: 'SYSTEM',
        title: 'Account Suspended',
        message: `Your account has been suspended. Reason: ${reason}. Contact support if you believe this is an error.`,
      });

      return { success: true, action: 'banned', userId };
    }

    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get moderation queue
 */
export async function getModerationQueue({ status = 'pending', limit = 50 }) {
  const reports = await prisma.eventLog.findMany({
    where: {
      event_type: 'moderation.report',
      result: status,
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return reports.map((r) => ({
    id: r.id,
    contentType: r.resource_type,
    contentId: r.resource_id,
    reporterId: r.actor_user_id,
    metadata: JSON.parse(r.metadata || '{}'),
    createdAt: r.timestamp,
  }));
}

/**
 * Calculate user trust score
 */
export async function getUserTrustScore(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      rescueLevel: true,
      successfulReunions: true,
      _count: {
        select: {
          cases: true,
          rescueSquadMemberships: true,
        },
      },
    },
  });

  if (!user) return 0;

  let score = 50; // Base score

  // Account age bonus (up to 20 points)
  const daysOld = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
  score += Math.min(daysOld / 30 * 5, 20);

  // Activity bonus
  score += Math.min(user._count.cases * 2, 10);
  score += Math.min(user._count.rescueSquadMemberships * 5, 10);

  // Success bonus
  score += Math.min(user.successfulReunions * 3, 10);

  return Math.min(Math.round(score), 100);
}
