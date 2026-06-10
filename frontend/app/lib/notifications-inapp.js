/**
 * In-App Notification Module
 *
 * Creates and manages in-app notifications stored in the database.
 * Split from notifications.js for module separation.
 */

import prisma from '@/app/lib/prisma';

export async function createInAppNotification({
  userId,
  type,
  title,
  message,
  data = null,
  actionUrl = null,
  expiresAt = null
}) {
  try {
    if (!userId || !type || !title || !message) {
      return { success: false, error: 'Missing required fields' };
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        actionUrl,
        expiresAt,
      },
    });

    return { success: true, notification };
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create notifications for multiple users at once
 *
 * @param {Array<string>} userIds - Array of user IDs to notify
 * @param {Object} notification - Notification details (type, title, message, data, actionUrl, expiresAt)
 * @returns {Promise<{success: boolean, count: number, errors: Array}>}
 */
export async function createBulkNotifications(userIds, notification) {
  const { type, title, message, data = null, actionUrl = null, expiresAt = null } = notification;

  if (!userIds || userIds.length === 0) {
    return { success: false, count: 0, errors: ['No user IDs provided'] };
  }

  const errors = [];
  let count = 0;

  try {
    // Use createMany for efficiency
    const result = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        actionUrl,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    count = result.count;
    return { success: true, count, errors };
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, count, errors: [error.message] };
  }
}

/**
 * Notify a user about a case update
 */
export async function notifyUserCaseUpdate({ userId, missionNumber, petName, updateType, message, missionId }) {
  return createInAppNotification({
    userId,
    type: 'CASE_UPDATE',
    title: `Case ${missionNumber}: ${updateType}`,
    message,
    data: { missionNumber, petName, updateType },
    actionUrl: missionId ? `/cases/${missionNumber}` : null,
  });
}

/**
 * Notify a user about a new sighting
 */
export async function notifyUserSighting({ userId, petName, missionNumber, location, confidence }) {
  return createInAppNotification({
    userId,
    type: 'SIGHTING',
    title: `New sighting of ${petName}!`,
    message: `Someone reported seeing ${petName} near ${location}. Confidence: ${confidence}/10`,
    data: { missionNumber, location, confidence },
    actionUrl: `/cases/${missionNumber}`,
  });
}

/**
 * Notify squad members about a case assignment
 */
export async function notifySquadCaseAssignment({ memberIds, squadName, petName, missionNumber, location }) {
  return createBulkNotifications(memberIds, {
    type: 'SQUAD_MESSAGE',
    title: `${squadName}: New case assigned`,
    message: `Your rescue force has taken on a new case: ${petName} in ${location}. Join the search effort!`,
    data: { squadName, missionNumber, petName, location },
    actionUrl: `/cases/${missionNumber}/coordinate`,
  });
}

/**
 * Notify squad leaders about a new member join request
 */
export async function notifySquadJoinRequest({ leaderIds, squadName, squadId, requesterName }) {
  return createBulkNotifications(leaderIds, {
    type: 'SQUAD_MESSAGE',
    title: `New join request for ${squadName}`,
    message: `${requesterName} has requested to join your rescue force. Review their request.`,
    data: { squadName, squadId, requesterName },
    actionUrl: `/rescue-forces/${squadId}/members`,
  });
}

/**
 * Notify user about role change in squad
 */
export async function notifyUserRoleChange({ userId, squadName, squadId, newRole, changedBy }) {
  const roleMessages = {
    LEADER: `You've been promoted to Leader in ${squadName}! You can now manage members and accept cases.`,
    COORDINATOR: `You've been made a Coordinator in ${squadName}! You can now help organize searches.`,
    MEMBER: `Your role in ${squadName} has been updated to Member.`,
  };

  return createInAppNotification({
    userId,
    type: 'SQUAD_MESSAGE',
    title: `Role updated in ${squadName}`,
    message: roleMessages[newRole] || `Your role in ${squadName} has been changed to ${newRole}.`,
    data: { squadName, squadId, newRole, changedBy },
    actionUrl: `/rescue-forces/${squadId}`,
  });
}

/**
 * Send a system notification to a user
 */
export async function notifyUserSystem({ userId, title, message, actionUrl = null }) {
  return createInAppNotification({
    userId,
    type: 'SYSTEM',
    title,
    message,
    actionUrl,
  });
}
