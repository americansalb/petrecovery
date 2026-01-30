/**
 * Feedback API
 *
 * POST /api/feedback - Submit user feedback
 * GET /api/feedback - Get feedback (admin only)
 *
 * Per Actions_Guide.md Phase 7 specification.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// In-memory feedback storage (in production, use a database table)
// This is a simple solution that avoids schema dependencies
const feedbackStore = [];

// =============================================================================
// POST - Submit feedback
// =============================================================================

export async function POST(request) {
  try {
    const session = await getServerSession();
    const body = await request.json();

    const { rating, category, message, feature, missionId, timestamp, userAgent } = body;

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

    // Create feedback entry
    const feedbackEntry = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rating,
      category: category || 'general',
      feature: feature || 'general',
      message: message || null,
      missionId: missionId || null,
      userEmail: session?.user?.email || null,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: userAgent || null,
      createdAt: new Date().toISOString(),
    };

    // Store in memory and log
    feedbackStore.push(feedbackEntry);

    // Log for monitoring
    console.log('[FEEDBACK]', JSON.stringify(feedbackEntry));

    // If this is a bug report, also log it with warning level
    if (rating === 'bug') {
      console.warn('[BUG REPORT]', {
        id: feedbackEntry.id,
        feature,
        category,
        message: message?.substring(0, 100),
        userEmail: session?.user?.email,
        missionId,
      });
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedbackEntry.id,
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

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rating = searchParams.get('rating');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filter feedback
    let filtered = [...feedbackStore];
    if (rating) filtered = filtered.filter(f => f.rating === rating);
    if (category) filtered = filtered.filter(f => f.category === category);

    // Sort by newest first
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    // Get counts by rating
    const counts = {
      positive: feedbackStore.filter(f => f.rating === 'positive').length,
      neutral: feedbackStore.filter(f => f.rating === 'neutral').length,
      negative: feedbackStore.filter(f => f.rating === 'negative').length,
      bug: feedbackStore.filter(f => f.rating === 'bug').length,
    };

    return NextResponse.json({
      feedback: paginated,
      counts,
      total: filtered.length,
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
