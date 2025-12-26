/**
 * Forum Statistics API
 *
 * Returns overall forum statistics like total threads, posts, members.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/stats
 * Get forum-wide statistics
 */
export async function GET() {
  try {
    // Get counts in parallel
    const [
      totalThreads,
      totalPosts,
      totalMembers,
      newestMember,
      totalCategories,
    ] = await Promise.all([
      prisma.forumThread.count({ where: { isDeleted: false } }),
      prisma.forumPost.count({ where: { isDeleted: false } }),
      prisma.forumProfile.count(),
      prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, createdAt: true },
      }),
      prisma.forumCategory.count(),
    ]);

    // Get category stats with thread/post counts
    const categoryStats = await prisma.forumCategory.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        description: true,
        threadCount: true,
        displayOrder: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Calculate total posts per category
    const categoryPostCounts = await prisma.forumPost.groupBy({
      by: ['threadId'],
      _count: true,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalThreads,
        totalPosts,
        totalMembers,
        totalCategories,
        newestMember: newestMember ? {
          id: newestMember.id,
          name: newestMember.firstName,
          joinedAt: newestMember.createdAt,
        } : null,
      },
      categories: categoryStats,
    });
  } catch (error) {
    console.error('Error getting forum stats:', error);
    return NextResponse.json({
      success: true,
      stats: {
        totalThreads: 0,
        totalPosts: 0,
        totalMembers: 0,
        totalCategories: 0,
        newestMember: null,
      },
      categories: [],
    });
  }
}
