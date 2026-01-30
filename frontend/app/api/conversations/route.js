/**
 * Conversations API - Create and List Conversations
 *
 * POST /api/conversations - Create a conversation between owner and finder
 * GET /api/conversations - List user's conversations
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { sendPushToUser, PUSH_TEMPLATES, isPushConfigured } from '@/app/lib/push';
import { getEmailBaseUrl } from '@/app/lib/config';

/**
 * POST /api/conversations
 * Create a new conversation when a match is found
 */
export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lostCaseId, foundCaseId, matchScore, matchDetails } = body;

    if (!lostCaseId || !foundCaseId) {
      return NextResponse.json(
        { error: 'Both lostCaseId and foundCaseId are required' },
        { status: 400 }
      );
    }

    // Get the current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get both cases
    const [lostCase, foundCase] = await Promise.all([
      prisma.case.findUnique({
        where: { id: lostCaseId },
        include: { reporter: true }
      }),
      prisma.case.findUnique({
        where: { id: foundCaseId },
        include: { reporter: true }
      })
    ]);

    if (!lostCase || !foundCase) {
      return NextResponse.json({ error: 'One or both cases not found' }, { status: 404 });
    }

    if (lostCase.reportType !== 'LOST' || foundCase.reportType !== 'FOUND') {
      return NextResponse.json(
        { error: 'Invalid case types. Need one LOST and one FOUND case.' },
        { status: 400 }
      );
    }

    // Verify the current user is either the owner or finder
    const isOwner = currentUser.id === lostCase.reporterId;
    const isFinder = currentUser.id === foundCase.reporterId;

    if (!isOwner && !isFinder) {
      return NextResponse.json(
        { error: 'You must be the owner or finder to start a conversation' },
        { status: 403 }
      );
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findUnique({
      where: {
        lostCaseId_foundCaseId: {
          lostCaseId,
          foundCaseId
        }
      }
    });

    if (existingConversation) {
      return NextResponse.json({
        success: true,
        conversation: existingConversation,
        isNew: false
      });
    }

    // Create the conversation
    const conversation = await prisma.conversation.create({
      data: {
        lostCaseId,
        foundCaseId,
        ownerId: lostCase.reporterId,
        finderId: foundCase.reporterId,
        matchScore: matchScore || 0,
        matchDetails: JSON.stringify(matchDetails || {}),
        status: 'ACTIVE'
      }
    });

    // Create initial system message
    await prisma.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: 'system',
        senderRole: 'SYSTEM',
        content: `A potential match has been found! Match score: ${matchScore || 'N/A'}%. Please communicate to verify if this is your pet.`,
        messageType: 'SYSTEM'
      }
    });

    // Notify the other party via email
    const otherParty = isOwner ? foundCase.reporter : lostCase.reporter;
    const petName = lostCase.petName || 'your pet';

    if (otherParty?.email) {
      sendEmail({
        to: otherParty.email,
        subject: `New Message About ${petName} - PetRecovery.org`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Someone wants to connect about a potential match!</h2>
            <p>Hi ${otherParty.firstName || 'there'},</p>
            <p>${isOwner ? 'A pet owner' : 'Someone who found a pet'} has started a conversation about a potential match.</p>

            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <p><strong>Pet:</strong> ${petName}</p>
              <p><strong>Match Score:</strong> ${matchScore || 'N/A'}%</p>
            </div>

            <p>
              <a href="${getEmailBaseUrl()}/messages/${conversation.id}"
                 style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Conversation
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              For your safety, communicate through PetRecovery.org until you're ready to share contact information.
            </p>
          </div>
        `
      }).catch(err => console.error('Failed to send conversation notification:', err));
    }

    // Send push notification to the other party (instant alert!)
    if (isPushConfigured()) {
      const otherPartyId = isOwner ? foundCase.reporterId : lostCase.reporterId;
      const foundLocation = foundCase.lastSeenAddress?.split(',')[0] || 'your area';

      const pushPayload = PUSH_TEMPLATES.MATCH_ALERT(
        petName,
        matchScore || 0,
        foundLocation,
        conversation.id
      );

      sendPushToUser(prisma, otherPartyId, pushPayload)
        .then(result => {
          if (result.sent > 0) {
            console.log(`Push notification sent to ${result.sent} device(s) for match alert`);
          }
        })
        .catch(err => console.error('Failed to send push notification:', err));
    }

    return NextResponse.json({
      success: true,
      conversation,
      isNew: true
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations
 * List all conversations for the current user
 */
export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const take = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
    const skip = parseInt(searchParams.get('offset') || '0', 10) || 0;

    // Get conversations with last message included
    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            { finderId: user.id }
          ],
          status: { not: 'CLOSED' }
        },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.conversation.count({
        where: {
          OR: [
            { ownerId: user.id },
            { finderId: user.id }
          ],
          status: { not: 'CLOSED' }
        }
      })
    ]);

    // Batch: collect all unique case IDs and other-party user IDs
    const caseIds = new Set();
    const otherPartyIds = new Set();
    for (const conv of conversations) {
      caseIds.add(conv.lostCaseId);
      caseIds.add(conv.foundCaseId);
      otherPartyIds.add(conv.ownerId === user.id ? conv.finderId : conv.ownerId);
    }

    // 2 bulk queries instead of 4*N individual queries
    const [cases, otherParties, unreadCounts] = await Promise.all([
      prisma.case.findMany({
        where: { id: { in: [...caseIds] } },
        select: {
          id: true,
          petName: true,
          petPhotoUrl: true,
          petSpecies: true,
          petBreed: true,
          lastSeenAddress: true
        }
      }),
      prisma.user.findMany({
        where: { id: { in: [...otherPartyIds] } },
        select: { id: true, firstName: true, lastName: true }
      }),
      prisma.directMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversations.map(c => c.id) },
          senderId: { not: user.id },
          readAt: null
        },
        _count: { id: true }
      })
    ]);

    // Build lookup maps
    const caseMap = Object.fromEntries(cases.map(c => [c.id, c]));
    const userMap = Object.fromEntries(otherParties.map(u => [u.id, u]));
    const unreadMap = Object.fromEntries(unreadCounts.map(u => [u.conversationId, u._count.id]));

    // Enrich conversations using maps (no additional queries)
    const enrichedConversations = conversations.map(conv => {
      const otherPartyId = conv.ownerId === user.id ? conv.finderId : conv.ownerId;
      return {
        ...conv,
        lostCase: caseMap[conv.lostCaseId] || null,
        foundCase: caseMap[conv.foundCaseId] || null,
        otherPartyName: userMap[otherPartyId]?.firstName || 'Unknown',
        userRole: conv.ownerId === user.id ? 'owner' : 'finder',
        unreadCount: unreadMap[conv.id] || 0,
        lastMessage: conv.messages[0] || null
      };
    });

    return NextResponse.json({
      success: true,
      conversations: enrichedConversations,
      total: totalCount,
      limit: take,
      offset: skip
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error.message },
      { status: 500 }
    );
  }
}
