/**
 * Feedback API
 *
 * POST /api/feedback - Submit user feedback
 * GET /api/feedback - Get feedback (admin only)
 *
 * Per Actions_Guide.md Phase 7 specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// TYPES
// =============================================================================

interface FeedbackBody {
  rating: 'positive' | 'neutral' | 'negative' | 'bug';
  category: string;
  message?: string;
  feature?: string;
  caseId?: string;
  timestamp?: string;
  userAgent?: string;
}

// =============================================================================
// POST - Submit feedback
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    const body: FeedbackBody = await request.json();

    const { rating, category, message, feature, caseId, timestamp, userAgent } = body;

    // Validate required fields
    if (!rating || !['positive', 'neutral', 'negative', 'bug'].includes(rating)) {
      return NextResponse.json(
        { error: 'Valid rating is required' },
        { status: 400 }
      );
    }

    // Bug reports require a message
    if (rating === 'bug' && (!message || !message.trim())) {
      return NextResponse.json(
        { error: 'Bug reports require a description' },
        { status: 400 }
      );
    }

    // Get user ID if authenticated
    let userId: string | null = null;
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = user?.id || null;
    }

    // Store feedback
    // Note: In production, you might want a dedicated Feedback model
    // For now, we'll use SquadActivity with type USER_FEEDBACK
    const feedback = await prisma.squadActivity.create({
      data: {
        type: 'USER_FEEDBACK',
        message: message || `${rating} feedback for ${feature || 'general'}`,
        ...(userId && { actor: { connect: { id: userId } } }),
        ...(caseId && { case: { connect: { id: caseId } } }),
        details: JSON.stringify({
          rating,
          category: category || 'general',
          feature: feature || 'general',
          message: message || null,
          timestamp: timestamp || new Date().toISOString(),
          userAgent: userAgent || null,
          authenticated: !!userId,
        }),
      },
    });

    // If this is a bug report, also log it for priority handling
    if (rating === 'bug') {
      console.warn('[BUG REPORT]', {
        id: feedback.id,
        feature,
        category,
        message: message?.substring(0, 100),
        userId,
        caseId,
      });
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    console.error('Feedback POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Retrieve feedback (admin only)
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rating = searchParams.get('rating');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const whereClause: any = {
      type: 'USER_FEEDBACK',
    };

    // Get feedback entries
    const feedbackEntries = await prisma.squadActivity.findMany({
      where: whereClause,
      include: {
        actor: {
          select: { id: true, firstName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Parse details and filter
    const feedback = feedbackEntries
      .map((entry) => {
        const details = JSON.parse(entry.details || '{}');
        return {
          id: entry.id,
          rating: details.rating,
          category: details.category,
          feature: details.feature,
          message: details.message,
          timestamp: details.timestamp,
          createdAt: entry.createdAt,
          user: entry.actor
            ? {
                id: entry.actor.id,
                name: entry.actor.firstName,
                email: entry.actor.email,
              }
            : null,
          caseId: entry.caseId,
        };
      })
      .filter((f) => {
        if (rating && f.rating !== rating) return false;
        if (category && f.category !== category) return false;
        return true;
      });

    // Get counts by rating
    const counts = {
      positive: feedback.filter((f) => f.rating === 'positive').length,
      neutral: feedback.filter((f) => f.rating === 'neutral').length,
      negative: feedback.filter((f) => f.rating === 'negative').length,
      bug: feedback.filter((f) => f.rating === 'bug').length,
    };

    return NextResponse.json({
      feedback,
      counts,
      total: feedbackEntries.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Feedback GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback' },
      { status: 500 }
    );
  }
}
