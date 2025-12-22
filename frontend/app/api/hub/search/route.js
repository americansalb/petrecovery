/**
 * Forum Search API
 *
 * GET /api/hub/search - Search threads and posts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/hub/search
 * Search forum threads and posts
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'threads'; // threads, posts, all
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        pagination: { page: 1, totalPages: 0, totalCount: 0 },
        message: 'Please enter at least 2 characters to search',
      });
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    let results = [];
    let totalCount = 0;

    if (type === 'threads' || type === 'all') {
      // Build where clause for threads
      const threadWhere = {
        isDeleted: false,
        isHidden: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (category) {
        threadWhere.category = { slug: category };
      }

      const threadCount = await prisma.forumThread.count({ where: threadWhere });

      const threads = await prisma.forumThread.findMany({
        where: threadWhere,
        orderBy: [
          { isPinned: 'desc' },
          { lastActivityAt: 'desc' },
        ],
        skip: type === 'all' ? 0 : skip,
        take: type === 'all' ? 10 : limit,
        include: {
          category: {
            select: { name: true, slug: true, icon: true, color: true },
          },
          author: {
            select: { id: true, firstName: true },
          },
        },
      });

      const threadResults = threads.map(t => ({
        type: 'thread',
        id: t.id,
        title: t.title,
        slug: t.slug,
        content: highlightSearch(t.content.slice(0, 200), searchTerms),
        category: t.category,
        author: t.author,
        replyCount: t.replyCount,
        viewCount: t.viewCount,
        isPinned: t.isPinned,
        isSolved: t.isSolved,
        createdAt: t.createdAt,
        lastActivityAt: t.lastActivityAt,
      }));

      if (type === 'threads') {
        results = threadResults;
        totalCount = threadCount;
      } else {
        results.push(...threadResults);
        totalCount += threadCount;
      }
    }

    if (type === 'posts' || type === 'all') {
      // Build where clause for posts
      const postWhere = {
        isDeleted: false,
        content: { contains: query, mode: 'insensitive' },
        thread: {
          isDeleted: false,
          isHidden: false,
        },
      };

      if (category) {
        postWhere.thread.category = { slug: category };
      }

      const postCount = await prisma.forumPost.count({ where: postWhere });

      const posts = await prisma.forumPost.findMany({
        where: postWhere,
        orderBy: { createdAt: 'desc' },
        skip: type === 'all' ? 0 : skip,
        take: type === 'all' ? 10 : limit,
        include: {
          thread: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: {
                select: { name: true, slug: true, icon: true, color: true },
              },
            },
          },
          author: {
            select: { id: true, firstName: true },
          },
        },
      });

      const postResults = posts.map(p => ({
        type: 'post',
        id: p.id,
        content: highlightSearch(p.content.slice(0, 200), searchTerms),
        thread: p.thread,
        author: p.author,
        helpfulCount: p.helpfulCount,
        isSolution: p.isSolution,
        createdAt: p.createdAt,
      }));

      if (type === 'posts') {
        results = postResults;
        totalCount = postCount;
      } else {
        results.push(...postResults);
        totalCount += postCount;
      }
    }

    // Sort mixed results by recency if searching all
    if (type === 'all') {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return NextResponse.json({
      success: true,
      query,
      results,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * Highlight search terms in text
 */
function highlightSearch(text, terms) {
  if (!text || !terms || terms.length === 0) return text;

  let result = text;
  terms.forEach(term => {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    result = result.replace(regex, '**$1**');
  });

  return result;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
