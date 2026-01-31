/**
 * Single Conversation API
 *
 * GET /api/conversations/[id] - Get conversation with messages
 * PATCH /api/conversations/[id] - Update conversation status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';

/**
 * GET /api/conversations/[id]
 * Get a single conversation with all messages
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { isHidden: false }
        }
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify user is participant
    if (conversation.ownerId !== user.id && conversation.finderId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get case details
    const [lostCase, foundCase] = await Promise.all([
      prisma.case.findUnique({
        where: { id: conversation.lostCaseId },
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          petPhotoUrl: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petSize: true,
          petDescription: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          status: true
        }
      }),
      prisma.case.findUnique({
        where: { id: conversation.foundCaseId },
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          petPhotoUrl: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petSize: true,
          petDescription: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          status: true
        }
      })
    ]);

    // Get participant info (limited for privacy)
    const [owner, finder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: conversation.ownerId },
        select: {
          id: true,
          firstName: true,
          createdAt: true,
          // Only include contact if revealed
          ...(conversation.ownerRevealed ? { email: true, phone: true } : {})
        }
      }),
      prisma.user.findUnique({
        where: { id: conversation.finderId },
        select: {
          id: true,
          firstName: true,
          createdAt: true,
          // Only include contact if revealed
          ...(conversation.finderRevealed ? { email: true, phone: true } : {})
        }
      })
    ]);

    // Mark unread messages as read
    await prisma.directMessage.updateMany({
      where: {
        conversationId: id,
        senderId: { not: user.id },
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    // Determine user's role
    const userRole = conversation.ownerId === user.id ? 'owner' : 'finder';

    return NextResponse.json({
      success: true,
      conversation: {
        ...conversation,
        matchDetails: JSON.parse(conversation.matchDetails || '{}'),
        lostCase,
        foundCase,
        owner: {
          ...owner,
          isCurrentUser: owner?.id === user.id
        },
        finder: {
          ...finder,
          isCurrentUser: finder?.id === user.id
        },
        userRole
      }
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation - reveal contact info, close, confirm reunion
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action, reason } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify user is participant
    const isOwner = conversation.ownerId === user.id;
    const isFinder = conversation.finderId === user.id;

    if (!isOwner && !isFinder) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let updateData = {};
    let systemMessage = null;

    switch (action) {
      case 'reveal_contact':
        // User wants to share their contact info
        if (isOwner) {
          updateData.ownerRevealed = true;
          systemMessage = `${user.firstName || 'The owner'} has shared their contact information.`;
        } else {
          updateData.finderRevealed = true;
          systemMessage = `${user.firstName || 'The finder'} has shared their contact information.`;
        }
        break;

      case 'confirm_reunion':
        // User confirms the pet has been reunited
        if (isOwner) {
          updateData.ownerVerified = true;
        }
        // If both confirm, mark as reunited
        if (conversation.ownerVerified || isOwner) {
          updateData.reunionConfirmed = true;
          updateData.status = 'REUNITED';
          updateData.closedAt = new Date();
          systemMessage = 'Reunion confirmed! Thank you for using PetRecovery.org to bring this family back together.';

          // Update the lost case as reunited
          await prisma.case.update({
            where: { id: conversation.lostCaseId },
            data: {
              status: 'REUNITED',
              resolution: 'REUNITED',
              resolvedAt: new Date(),
              foundById: conversation.finderId
            }
          });
        } else {
          systemMessage = `${user.firstName || 'A participant'} has confirmed the reunion. Waiting for confirmation from the other party.`;
        }
        break;

      case 'close':
        updateData.status = 'CLOSED';
        updateData.closedAt = new Date();
        updateData.closedBy = user.id;
        updateData.closeReason = reason || 'closed_by_user';
        systemMessage = `Conversation closed: ${reason || 'No reason provided'}`;
        break;

      case 'not_my_pet':
        updateData.status = 'CLOSED';
        updateData.closedAt = new Date();
        updateData.closedBy = user.id;
        updateData.closeReason = 'not_my_pet';
        systemMessage = 'This was not a match. The conversation has been closed.';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: updateData
    });

    // Create system message if needed
    if (systemMessage) {
      await prisma.directMessage.create({
        data: {
          conversationId: id,
          senderId: 'system',
          senderRole: 'SYSTEM',
          content: systemMessage,
          messageType: 'SYSTEM'
        }
      });
    }

    return NextResponse.json({
      success: true,
      conversation: updatedConversation
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation', details: error.message },
      { status: 500 }
    );
  }
}
