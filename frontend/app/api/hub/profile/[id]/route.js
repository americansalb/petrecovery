import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/profile/[id]
 *
 * Get a user's forum profile including their posts, threads, and badges.
 */
export async function GET(request, { params }) {
  try {
    const { id: userId } = await params;
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'posts'; // posts, threads, reactions
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get user basic info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create forum profile
    let forumProfile = await prisma.forumProfile.findUnique({
      where: { userId },
    });

    if (!forumProfile) {
      forumProfile = await prisma.forumProfile.create({
        data: { userId },
      });
    }

    // Get badges
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });

    // Check if user has shelter profile
    const shelterProfile = await prisma.shelterProfile.findFirst({
      where: { claimedById: userId },
      include: {
        shelter: {
          select: { name: true, city: true, state: true },
        },
      },
    });

    // Get activity based on tab
    let activity = [];
    let totalCount = 0;

    if (tab === 'threads') {
      totalCount = await prisma.forumThread.count({
        where: { authorId: userId, isDeleted: false },
      });

      const threads = await prisma.forumThread.findMany({
        where: { authorId: userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: {
            select: { name: true, slug: true, icon: true, color: true },
          },
        },
      });

      activity = threads.map(t => ({
        type: 'thread',
        id: t.id,
        title: t.title,
        slug: t.slug,
        content: t.content.slice(0, 150) + (t.content.length > 150 ? '...' : ''),
        category: t.category,
        replyCount: t.replyCount,
        viewCount: t.viewCount,
        isPinned: t.isPinned,
        isSolved: t.isSolved,
        createdAt: t.createdAt,
      }));
    } else if (tab === 'reactions') {
      // Get posts where user gave reactions
      totalCount = await prisma.forumReaction.count({
        where: { userId },
      });

      const reactions = await prisma.forumReaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          post: {
            include: {
              thread: {
                select: { title: true, slug: true },
              },
              author: {
                select: { firstName: true },
              },
            },
          },
        },
      });

      activity = reactions.map(r => ({
        type: 'reaction',
        id: r.id,
        reactionType: r.type,
        post: {
          id: r.post.id,
          content: r.post.content.slice(0, 100) + (r.post.content.length > 100 ? '...' : ''),
          author: r.post.author?.firstName,
          thread: r.post.thread,
        },
        createdAt: r.createdAt,
      }));
    } else {
      // Default: posts
      totalCount = await prisma.forumPost.count({
        where: { authorId: userId, isDeleted: false },
      });

      const posts = await prisma.forumPost.findMany({
        where: { authorId: userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          thread: {
            select: { title: true, slug: true },
          },
        },
      });

      activity = posts.map(p => ({
        type: 'post',
        id: p.id,
        content: p.content.slice(0, 200) + (p.content.length > 200 ? '...' : ''),
        thread: p.thread,
        helpfulCount: p.helpfulCount,
        heartCount: p.heartCount,
        isSolution: p.isSolution,
        createdAt: p.createdAt,
      }));
    }

    // Get stats
    const stats = {
      threadsCount: await prisma.forumThread.count({
        where: { authorId: userId, isDeleted: false },
      }),
      postsCount: await prisma.forumPost.count({
        where: { authorId: userId, isDeleted: false },
      }),
      helpfulReceived: forumProfile.helpfulReceived || 0,
      solutionsCount: forumProfile.solutionsCount || 0,
    };

    // Trust level description
    const trustLevelLabels = {
      0: 'New Member',
      1: 'Basic Member',
      2: 'Regular',
      3: 'Trusted',
      4: 'Community Leader',
    };

    return NextResponse.json({
      success: true,
      profile: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName?.[0] ? user.lastName[0] + '.' : '',
          joinedAt: user.createdAt,
          isAdmin: user.role === 'ADMIN',
          isModerator: user.role === 'MODERATOR' || user.role === 'ADMIN' || forumProfile.isModerator,
        },
        bio: forumProfile.bio,
        location: forumProfile.location,
        trustLevel: forumProfile.trustLevel,
        trustLevelLabel: trustLevelLabels[forumProfile.trustLevel] || 'Member',
        reputation: forumProfile.reputation,
        isVerifiedShelter: forumProfile.isVerifiedShelter,
        shelter: shelterProfile?.shelter,
        badges: userBadges.map(ub => ({
          id: ub.badge.id,
          name: ub.badge.name,
          icon: ub.badge.icon,
          description: ub.badge.description,
          earnedAt: ub.earnedAt,
        })),
        stats,
      },
      activity,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      isOwnProfile: session?.user?.id === userId,
    });
  } catch (error) {
    console.error('Error fetching forum profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
