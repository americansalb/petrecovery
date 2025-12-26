/**
 * Forum Categories API
 *
 * GET /api/hub/categories - List all categories with last post info
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/categories
 * List all forum categories with thread counts and last post info
 */
export async function GET() {
  try {
    const categories = await prisma.forumCategory.findMany({
      where: {
        isReadOnly: false,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Get detailed stats for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        // Get thread count
        const threadCount = await prisma.forumThread.count({
          where: {
            categoryId: category.id,
            isDeleted: false,
            isHidden: false,
          },
        });

        // Get post count (replies in this category)
        const postCount = await prisma.forumPost.count({
          where: {
            thread: {
              categoryId: category.id,
              isDeleted: false,
            },
            isDeleted: false,
          },
        });

        // Get last thread with activity
        const lastThread = await prisma.forumThread.findFirst({
          where: {
            categoryId: category.id,
            isDeleted: false,
            isHidden: false,
          },
          orderBy: { lastActivityAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            lastActivityAt: true,
            author: {
              select: { id: true, firstName: true },
            },
          },
        });

        // Get the actual last poster (could be from a reply)
        let lastPoster = lastThread?.author;
        if (lastThread) {
          const lastPost = await prisma.forumPost.findFirst({
            where: {
              threadId: lastThread.id,
              isDeleted: false,
            },
            orderBy: { createdAt: 'desc' },
            select: {
              author: {
                select: { id: true, firstName: true },
              },
              createdAt: true,
            },
          });
          if (lastPost) {
            lastPoster = lastPost.author;
          }
        }

        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          color: category.color,
          parentId: category.parentId,
          displayOrder: category.displayOrder,
          threadCount,
          postCount,
          lastPost: lastThread ? {
            threadId: lastThread.id,
            threadTitle: lastThread.title,
            threadSlug: lastThread.slug,
            at: lastThread.lastActivityAt,
            by: lastPoster,
          } : null,
        };
      })
    );

    // Group by parent (for sections)
    const topLevel = categoriesWithStats.filter(c => !c.parentId);
    const children = categoriesWithStats.filter(c => c.parentId);

    // Attach children to parents
    const organized = topLevel.map(parent => ({
      ...parent,
      children: children.filter(c => c.parentId === parent.id),
    }));

    return NextResponse.json({
      success: true,
      categories: organized,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
