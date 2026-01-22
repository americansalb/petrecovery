/**
 * Phase 7: Leadership Tools
 *
 * Force commander and division lead controls for coordinating volunteers.
 */

import prisma from '@/app/lib/prisma';
import { sendDivisionAlert } from './divisionAlerts';
import { sendPushToUser, PUSH_TEMPLATES } from '@/app/lib/push';

/**
 * Get leadership dashboard data
 */
export async function getLeadershipDashboard(userId, forceId) {
  // Verify user is a leader
  const membership = await prisma.squadMembership.findFirst({
    where: {
      userId,
      rescueForceId: forceId,
      role: { in: ['COMMANDER', 'DIVISION_LEAD', 'COORDINATOR'] },
      isActive: true,
    },
    include: {
      division: true,
      rescueForce: {
        include: {
          divisions: true,
          _count: {
            select: {
              members: { where: { isActive: true } },
              assignments: { where: { status: 'ACCEPTED' } },
            }
          }
        }
      }
    }
  });

  if (!membership) {
    return { success: false, error: 'Not authorized as force leader' };
  }

  const isCommander = membership.role === 'COMMANDER';
  const divisionId = membership.divisionId;

  // Get active cases
  const activeMissions = await prisma.caseAssignment.findMany({
    where: {
      rescueForceId: forceId,
      status: 'ACCEPTED',
      case: { status: 'ACTIVE' },
    },
    include: {
      case: true,
      _count: {
        select: {
          participants: { where: { isActive: true } }
        }
      }
    }
  });

  // Get pending join requests
  const joinRequests = await prisma.squadJoinRequest.findMany({
    where: {
      rescueForceId: forceId,
      status: 'PENDING',
      ...(divisionId && !isCommander ? { divisionId } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          rescueLevel: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get member list
  const members = await prisma.squadMembership.findMany({
    where: {
      rescueForceId: forceId,
      isActive: true,
      ...(divisionId && !isCommander ? { divisionId } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rescueLevel: true,
          lastActive: true,
        }
      },
      division: true,
    },
    orderBy: { joinedAt: 'desc' },
  });

  // Get recent activity
  const recentActivity = await getForceActivity(forceId, divisionId, 20);

  return {
    success: true,
    role: membership.role,
    isCommander,
    force: {
      id: membership.rescueForce.id,
      name: membership.rescueForce.name,
      memberCount: membership.rescueForce._count.members,
      activeCaseCount: membership.rescueForce._count.assignments,
    },
    division: membership.division,
    divisions: isCommander ? membership.rescueForce.divisions : null,
    activeMissions: activeMissions.map(a => ({
      assignmentId: a.id,
      missionId: a.case.id,
      petName: a.case.petName,
      petSpecies: a.case.petSpecies,
      status: a.case.status,
      activeVolunteers: a._count.participants,
      createdAt: a.case.createdAt,
    })),
    joinRequests,
    members: members.map(m => ({
      oderId: m.userId,
      name: `${m.user.firstName} ${m.user.lastName || ''}`.trim(),
      role: m.role,
      division: m.division?.name,
      rescueLevel: m.user.rescueLevel,
      lastActive: m.user.lastActive,
      joinedAt: m.joinedAt,
      stats: {
        casesParticipated: m.casesParticipated,
        searchHours: m.searchHours,
        areasMarked: m.areasMarked,
      }
    })),
    recentActivity,
  };
}

/**
 * Approve join request
 */
export async function approveJoinRequest(requestId, approverId, options = {}) {
  const { role = 'MEMBER', divisionId } = options;

  const request = await prisma.squadJoinRequest.findUnique({
    where: { id: requestId },
    include: { rescueForce: true }
  });

  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  // Create membership
  const membership = await prisma.squadMembership.create({
    data: {
      userId: request.userId,
      rescueForceId: request.rescueForceId,
      divisionId: divisionId || request.divisionId,
      role,
      isActive: true,
    }
  });

  // Update request status
  await prisma.squadJoinRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      reviewedById: approverId,
      reviewedAt: new Date(),
    }
  });

  // Update force member count
  await prisma.rescueForce.update({
    where: { id: request.rescueForceId },
    data: { memberCount: { increment: 1 } }
  });

  return {
    success: true,
    membershipId: membership.id,
    message: `Welcome to ${request.rescueForce.name}!`,
  };
}

/**
 * Reject join request
 */
export async function rejectJoinRequest(requestId, reviewerId, reason = null) {
  await prisma.squadJoinRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    }
  });

  return { success: true };
}

/**
 * Change member role
 */
export async function changeMemberRole(membershipId, newRole, changerId) {
  const membership = await prisma.squadMembership.findUnique({
    where: { id: membershipId },
  });

  if (!membership) {
    return { success: false, error: 'Membership not found' };
  }

  // Verify changer has authority
  const changerMembership = await prisma.squadMembership.findFirst({
    where: {
      userId: changerId,
      rescueForceId: membership.rescueForceId,
      role: 'COMMANDER',
      isActive: true,
    }
  });

  if (!changerMembership) {
    return { success: false, error: 'Only commanders can change roles' };
  }

  await prisma.squadMembership.update({
    where: { id: membershipId },
    data: { role: newRole }
  });

  return { success: true };
}

/**
 * Assign member to division
 */
export async function assignToDivision(membershipId, divisionId, assignerId) {
  await prisma.squadMembership.update({
    where: { id: membershipId },
    data: { divisionId }
  });

  return { success: true };
}

/**
 * Remove member from force
 */
export async function removeMember(membershipId, removerId, reason = null) {
  const membership = await prisma.squadMembership.findUnique({
    where: { id: membershipId },
    include: { rescueForce: true }
  });

  if (!membership) {
    return { success: false, error: 'Membership not found' };
  }

  await prisma.squadMembership.update({
    where: { id: membershipId },
    data: {
      isActive: false,
      leftAt: new Date(),
      leftReason: reason,
    }
  });

  // Update force member count
  await prisma.rescueForce.update({
    where: { id: membership.rescueForceId },
    data: { memberCount: { decrement: 1 } }
  });

  return { success: true };
}

/**
 * Create a new division
 */
export async function createDivision(forceId, divisionData, creatorId) {
  const {
    name,
    description,
    centerLatitude,
    centerLongitude,
    radiusMiles = 3,
    zipCodes = [],
  } = divisionData;

  // Verify creator is commander
  const membership = await prisma.squadMembership.findFirst({
    where: {
      userId: creatorId,
      rescueForceId: forceId,
      role: 'COMMANDER',
      isActive: true,
    }
  });

  if (!membership) {
    return { success: false, error: 'Only commanders can create divisions' };
  }

  const division = await prisma.division.create({
    data: {
      rescueForceId: forceId,
      name,
      description,
      centerLatitude,
      centerLongitude,
      radiusMiles,
      zipCodes: JSON.stringify(zipCodes),
      isActive: true,
    }
  });

  return {
    success: true,
    division,
  };
}

/**
 * Broadcast message to division or force
 */
export async function broadcastMessage(options) {
  const { senderId, forceId, divisionId, message, type = 'ANNOUNCEMENT' } = options;

  // Verify sender is leader
  const membership = await prisma.squadMembership.findFirst({
    where: {
      userId: senderId,
      rescueForceId: forceId,
      role: { in: ['COMMANDER', 'DIVISION_LEAD', 'COORDINATOR'] },
      isActive: true,
    }
  });

  if (!membership) {
    return { success: false, error: 'Not authorized to broadcast' };
  }

  if (divisionId) {
    // Send to specific division
    return sendDivisionAlert(divisionId, {
      type,
      title: 'Team Update',
      body: message,
      priority: 'NORMAL',
    });
  } else {
    // Send to entire force
    const force = await prisma.rescueForce.findUnique({
      where: { id: forceId },
      include: { divisions: { where: { isActive: true } } }
    });

    const results = [];
    for (const division of force.divisions) {
      const result = await sendDivisionAlert(division.id, {
        type,
        title: 'Force Announcement',
        body: message,
        priority: 'NORMAL',
      });
      results.push(result);
    }

    return { success: true, results };
  }
}

/**
 * Reassign search areas
 */
export async function reassignSearchArea(options) {
  const { cellId, fromUserId, toUserId, leaderId } = options;

  const cell = await prisma.gridCell.findUnique({
    where: { id: cellId },
  });

  if (!cell) {
    return { success: false, error: 'Cell not found' };
  }

  // Release from current volunteer
  if (fromUserId) {
    await prisma.gridCell.update({
      where: { id: cellId },
      data: {
        claimedById: null,
        claimedAt: null,
        status: 'UNSEARCHED',
      }
    });
  }

  // Assign to new volunteer
  if (toUserId) {
    await prisma.gridCell.update({
      where: { id: cellId },
      data: {
        claimedById: toUserId,
        claimedAt: new Date(),
        status: 'IN_PROGRESS',
      }
    });

    // Notify the volunteer about new assignment
    try {
      const payload = PUSH_TEMPLATES.GENERIC(
        '📍 New Search Area Assigned',
        'You have been assigned a new search area. Tap to view on map.',
        '/'
      );
      payload.tag = `assignment-${cellId}`;
      await sendPushToUser(prisma, toUserId, payload);
    } catch (err) {
      console.error('Error notifying volunteer of assignment:', err);
    }
  }

  return { success: true };
}

/**
 * Close search section (mark multiple cells as not needing search)
 */
export async function closeSearchSection(options) {
  const { gridId, cellIds, reason, leaderId } = options;

  await prisma.gridCell.updateMany({
    where: {
      gridId,
      id: { in: cellIds },
    },
    data: {
      status: 'CLOSED',
      notes: reason,
      claimedById: null,
      claimedAt: null,
    }
  });

  return {
    success: true,
    closedCount: cellIds.length,
  };
}

/**
 * Get force activity feed
 */
async function getForceActivity(forceId, divisionId, limit = 20) {
  const activities = [];

  // Get recent participations
  const participations = await prisma.caseParticipant.findMany({
    where: {
      assignment: { rescueForceId: forceId },
    },
    orderBy: { optedInAt: 'desc' },
    take: limit,
    include: {
      user: { select: { firstName: true } },
      assignment: {
        include: { case: { select: { petName: true } } }
      }
    }
  });

  for (const p of participations) {
    activities.push({
      type: 'VOLUNTEER_JOINED',
      timestamp: p.optedInAt,
      user: p.user.firstName,
      message: `joined search for ${p.assignment.case.petName}`,
    });
  }

  // Get recent sightings
  const sightings = await prisma.caseSighting.findMany({
    where: {
      case: {
        assignments: {
          some: { rescueForceId: forceId }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reporter: { select: { firstName: true } },
      case: { select: { petName: true } },
    }
  });

  for (const s of sightings) {
    activities.push({
      type: s.isPetFound ? 'PET_FOUND' : 'SIGHTING',
      timestamp: s.createdAt,
      user: s.reporter?.firstName,
      message: s.isPetFound
        ? `found ${s.case.petName}!`
        : `reported sighting of ${s.case.petName}`,
    });
  }

  // Sort and return
  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export default {
  getLeadershipDashboard,
  approveJoinRequest,
  rejectJoinRequest,
  changeMemberRole,
  assignToDivision,
  removeMember,
  createDivision,
  broadcastMessage,
  reassignSearchArea,
  closeSearchSection,
};
