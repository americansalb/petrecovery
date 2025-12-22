/**
 * Forum Categories API
 *
 * GET /api/hub/categories - List all categories
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/categories
 * List all forum categories with thread counts
 */
export async function GET() {
  try {
    const categories = await prisma.forumCategory.findMany({
      where: {
        isReadOnly: false,
        parentId: null, // Top-level categories only
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        children: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { threads: true }
        }
      }
    });

    // Get recent threads for each category
    const categoriesWithRecent = await Promise.all(
      categories.map(async (category) => {
        const recentThreads = await prisma.forumThread.findMany({
          where: {
            categoryId: category.id,
            isHidden: false,
          },
          orderBy: { lastActivityAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            slug: true,
            authorId: true,
            replyCount: true,
            lastActivityAt: true,
          }
        });

        return {
          ...category,
          threadCount: category._count.threads,
          recentThreads,
        };
      })
    );

    return NextResponse.json({
      success: true,
      categories: categoriesWithRecent,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
