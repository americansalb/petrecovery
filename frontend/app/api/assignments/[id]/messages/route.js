import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/assignments/[id]/messages - Get all messages for a case
export async function GET(request, { params }) {
  try {
    const { id: assignmentId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const before = searchParams.get('before'); // For pagination

    const messages = await prisma.squadMessage.findMany({
      where: {
        assignmentId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/messages - Send a message
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;
    const body = await request.json();
    const { content, type = 'CHAT', photoUrls = [], location } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content required' },
        { status: 400 }
      );
    }

    // Verify user is a participant or force leader
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        participants: {
          where: {
            userId: session.user.id,
            isActive: true,
          },
        },
        rescueForce: {
          include: {
            members: {
              where: {
                userId: session.user.id,
                role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] },
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const isParticipant = assignment.participants.length > 0;
    const isLeader = assignment.rescueForce.members.length > 0;

    if (!isParticipant && !isLeader) {
      return NextResponse.json(
        { error: 'You must be participating in this case to send messages' },
        { status: 403 }
      );
    }

    // Only leaders can send ANNOUNCEMENT type messages
    if (type === 'ANNOUNCEMENT' && !isLeader) {
      return NextResponse.json(
        { error: 'Only force leaders can send announcements' },
        { status: 403 }
      );
    }

    const message = await prisma.squadMessage.create({
      data: {
        assignmentId,
        authorId: session.user.id,
        content: content.trim(),
        type,
        photoUrls: JSON.stringify(photoUrls),
        location: location ? JSON.stringify(location) : null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true,
          },
        },
      },
    });

    // Send push notifications to other participants
    try {
      // Get assignment details with participants and mission
      const assignment = await prisma.caseAssignment.findUnique({
        where: { id },
        select: {
          mission: {
            select: {
              missionNumber: true,
              ownerId: true,
            },
          },
          participants: {
            where: {
              AND: [
                { status: 'ACTIVE' },
                { userId: { not: session.user.id } }, // Don't notify the sender
              ],
            },
            select: { userId: true },
          },
        },
      });

      if (assignment && message.type === 'USER') {
        const participantIds = [
          ...assignment.participants.map(p => p.userId),
          assignment.mission.ownerId, // Also notify pet owner
        ].filter(Boolean).filter(id => id !== session.user.id);

        if (participantIds.length > 0) {
          const { sendChatMessagePushNotification } = await import('@/app/lib/notifications');
          const senderName = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Team member';
          const messagePreview = content.length > 100 ? content.substring(0, 97) + '...' : content;

          await sendChatMessagePushNotification({
            participantIds,
            senderName,
            messagePreview,
            missionNumber: assignment.mission.missionNumber,
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending chat message notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
