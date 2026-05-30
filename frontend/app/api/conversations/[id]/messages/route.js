/**
 * Messages API within a Conversation
 *
 * POST /api/conversations/[id]/messages - Send a new message
 * GET /api/conversations/[id]/messages - Get messages (with pagination)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { sendPushToUser, PUSH_TEMPLATES, isPushConfigured } from '@/app/lib/push';
import { getEmailBaseUrl } from '@/app/lib/config';

/**
 * POST /api/conversations/[id]/messages
 * Send a new message in the conversation
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = params;
    const body = await request.json();
    const { content, messageType, photoUrls, locationData } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Rate limiting: max 10 messages per minute
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
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

    // Check conversation is not closed
    if (conversation.status === 'CLOSED' || conversation.status === 'REUNITED') {
      return NextResponse.json(
        { error: 'Cannot send messages to a closed conversation' },
        { status: 400 }
      );
    }

    // Create the message
    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        senderRole: isOwner ? 'OWNER' : 'FINDER',
        content: content.trim(),
        messageType: messageType || 'TEXT',
        photoUrls: JSON.stringify(photoUrls || []),
        locationData: locationData ? JSON.stringify(locationData) : null
      }
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: isOwner ? 'PENDING_FINDER' : 'PENDING_OWNER'
      }
    });

    // Notify other party via email (async, don't wait)
    const otherPartyId = isOwner ? conversation.finderId : conversation.ownerId;
    const otherParty = await prisma.user.findUnique({
      where: { id: otherPartyId },
      select: { email: true, firstName: true }
    });

    // Get pet name from lost case for context
    const lostCase = await prisma.case.findUnique({
      where: { id: conversation.lostCaseId },
      select: { petName: true }
    });

    if (otherParty?.email) {
      sendEmail({
        to: otherParty.email,
        subject: `New message about ${lostCase?.petName || 'a pet'} - ReunitePets.org`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">You have a new message!</h2>
            <p>Hi ${otherParty.firstName || 'there'},</p>
            <p>${user.firstName || (isOwner ? 'The pet owner' : 'The finder')} sent you a message about ${lostCase?.petName || 'a potential match'}.</p>

            <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #374151; font-style: italic;">"${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"</p>
            </div>

            <p>
              <a href="${getEmailBaseUrl()}/messages/${conversationId}"
                 style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reply Now
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              Respond quickly to help reunite this pet with their family!
            </p>
          </div>
        `
      }).catch(err => console.error('Failed to send message notification:', err));

      // Send push notification (instant!)
      if (isPushConfigured()) {
        const senderName = user.firstName || (isOwner ? 'Pet Owner' : 'Finder');
        const pushPayload = PUSH_TEMPLATES.NEW_MESSAGE(
          senderName,
          content.substring(0, 100),
          conversationId
        );

        sendPushToUser(prisma, otherPartyId, pushPayload)
          .then(result => {
            if (result.sent > 0) {
              console.log(`Push notification sent to ${result.sent} device(s) for new message`);
            }
          })
          .catch(err => console.error('Failed to send push notification:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        photoUrls: JSON.parse(message.photoUrls),
        locationData: message.locationData ? JSON.parse(message.locationData) : null
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/[id]/messages
 * Get messages with pagination
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Cursor for pagination

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify user is participant
    if (conversation.ownerId !== user.id && conversation.finderId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build query
    const whereClause = {
      conversationId,
      isHidden: false,
      ...(before ? { createdAt: { lt: new Date(before) } } : {})
    };

    const messages = await prisma.directMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1 // Get one extra to check if there's more
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    // Mark messages as read
    await prisma.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    // Format messages
    const formattedMessages = messages.map(msg => ({
      ...msg,
      photoUrls: JSON.parse(msg.photoUrls || '[]'),
      locationData: msg.locationData ? JSON.parse(msg.locationData) : null,
      isOwnMessage: msg.senderId === user.id
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages.reverse(), // Return in chronological order
      hasMore,
      nextCursor: hasMore ? messages[messages.length - 1].createdAt.toISOString() : null
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error.message },
      { status: 500 }
    );
  }
}
