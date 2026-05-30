/**
 * Forum Threads API
 *
 * GET /api/hub/threads - List threads (with filtering)
 * POST /api/hub/threads - Create a new thread
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// Helper to generate slug from title
function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
}

/**
 * GET /api/hub/threads
 * List threads with optional filtering
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const sort = searchParams.get('sort') || 'recent'; // recent, popular, unanswered
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const search = searchParams.get('search');
    const urgency = searchParams.get('urgency');

    // Build where clause
    const where = {
      isHidden: false,
    };

    if (categorySlug) {
      const category = await prisma.forumCategory.findUnique({
        where: { slug: categorySlug }
      });
      if (category) {
        where.categoryId = category.id;
      }
    }

    if (urgency) {
      where.urgencyLevel = urgency;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    let orderBy = [];
    switch (sort) {
      case 'popular':
        orderBy = [
          { isPinned: 'desc' },
          { viewCount: 'desc' },
          { replyCount: 'desc' },
        ];
        break;
      case 'unanswered':
        where.replyCount = 0;
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = [
          { isPinned: 'desc' },
          { lastActivityAt: 'desc' },
        ];
    }

    // Fetch threads
    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: {
            select: { name: true, slug: true, icon: true, color: true }
          },
        }
      }),
      prisma.forumThread.count({ where }),
    ]);

    // Get author info for threads
    const authorIds = [...new Set(threads.map(t => t.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      }
    });

    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

    const threadsWithAuthors = threads.map(thread => ({
      ...thread,
      author: authorMap[thread.authorId] || { firstName: 'Unknown', lastName: '' },
    }));

    return NextResponse.json({
      success: true,
      threads: threadsWithAuthors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hub/threads
 * Create a new thread
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Require email verification for forum posting
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email to post on the forum', code: 'EMAIL_NOT_VERIFIED' },
        { status: 403 }
      );
    }

    // Get or create forum profile
    let forumProfile = await prisma.forumProfile.findUnique({
      where: { userId: user.id }
    });

    if (!forumProfile) {
      forumProfile = await prisma.forumProfile.create({
        data: { userId: user.id }
      });
    }

    // Check if banned
    if (forumProfile.isBanned) {
      return NextResponse.json(
        { error: 'You are banned from posting' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      content,
      categorySlug,
      locationTag,
      latitude,
      longitude,
      urgencyLevel,
      embeddedPetId,
      embeddedShelterId,
    } = body;

    if (!title || !content || !categorySlug) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      );
    }

    // Validate category and check permissions
    const category = await prisma.forumCategory.findUnique({
      where: { slug: categorySlug }
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category.isReadOnly) {
      return NextResponse.json(
        { error: 'This category is read-only' },
        { status: 403 }
      );
    }

    if (category.isModOnly && !forumProfile.isModerator) {
      return NextResponse.json(
        { error: 'Only moderators can post in this category' },
        { status: 403 }
      );
    }

    if (forumProfile.trustLevel < category.requiredTrustLevel) {
      return NextResponse.json(
        { error: `Trust level ${category.requiredTrustLevel} required to post here` },
        { status: 403 }
      );
    }

    // Create the thread
    const slug = generateSlug(title);

    const thread = await prisma.forumThread.create({
      data: {
        title,
        slug,
        content,
        categoryId: category.id,
        authorId: user.id,
        locationTag,
        latitude,
        longitude,
        urgencyLevel: urgencyLevel || 'NORMAL',
        embeddedPetId,
        embeddedShelterId,
      },
      include: {
        category: {
          select: { name: true, slug: true, icon: true, color: true }
        }
      }
    });

    // Update category stats
    await prisma.forumCategory.update({
      where: { id: category.id },
      data: {
        threadCount: { increment: 1 },
        lastActivityAt: new Date(),
      }
    });

    // Update user stats
    await prisma.forumProfile.update({
      where: { userId: user.id },
      data: {
        threadsCount: { increment: 1 },
        // Level up if first post
        trustLevel: forumProfile.trustLevel === 0 ? 1 : forumProfile.trustLevel,
      }
    });

    return NextResponse.json({
      success: true,
      thread,
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}
