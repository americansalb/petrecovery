import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/rescue-squads/[id]/posts
 *
 * List posts with sorting and filtering
 * Query params:
 *  - sort: 'hot' | 'new' | 'top' (default: 'hot')
 *  - divisionId: filter by division (optional)
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'hot';
    const divisionId = searchParams.get('divisionId');

    // Build where clause
    const where = {
      rescueSquadId: id,
      isDeleted: false,
      ...(divisionId && { divisionId }),
    };

    // Determine sorting
    let orderBy;
    if (sort === 'new') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'top') {
      orderBy = { upvotes: 'desc' };
    } else {
      // Hot: combination of upvotes and recency
      // For now, just sort by creation time with upvotes as secondary
      orderBy = [{ createdAt: 'desc' }];
    }

    // Fetch posts with author and vote information
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;

    const posts = await prisma.squadPost.findMany({
      where,
      orderBy,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
          },
        },
        votes: currentUserId ? {
          where: {
            userId: currentUserId,
          },
        } : false,
        comments: {
          where: {
            isDeleted: false,
            parentCommentId: null, // Only top-level comments
          },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            votes: currentUserId ? {
              where: {
                userId: currentUserId,
              },
            } : false,
            replies: {
              where: {
                isDeleted: false,
              },
              include: {
                author: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                votes: currentUserId ? {
                  where: {
                    userId: currentUserId,
                  },
                } : false,
                replies: {
                  where: {
                    isDeleted: false,
                  },
                  include: {
                    author: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    votes: currentUserId ? {
                      where: {
                        userId: currentUserId,
                      },
                    } : false,
                  },
                },
              },
            },
          },
        },
      },
      take: 50,
    });

    // Get author roles
    const authorIds = posts.map(p => p.authorId);
    const memberships = await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: id,
        userId: { in: authorIds },
      },
      select: {
        userId: true,
        role: true,
      },
    });

    const roleMap = new Map(memberships.map(m => [m.userId, m.role]));

    // Format posts
    const formattedPosts = posts.map(post => {
      const formatComments = (comments) => {
        return comments.map(comment => ({
          id: comment.id,
          authorId: comment.authorId,
          authorName: `${comment.author.firstName} ${comment.author.lastName || ''}`.trim(),
          authorRole: roleMap.get(comment.authorId) || 'MEMBER',
          content: comment.content,
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          userVote: comment.votes?.[0]?.vote || 0,
          createdAt: comment.createdAt,
          replies: comment.replies ? formatComments(comment.replies) : [],
        }));
      };

      return {
        id: post.id,
        authorId: post.authorId,
        authorName: `${post.author.firstName} ${post.author.lastName || ''}`.trim(),
        authorRole: roleMap.get(post.authorId) || 'MEMBER',
        divisionId: post.divisionId,
        divisionName: post.division?.name,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        commentCount: post.commentCount,
        userVote: post.votes?.[0]?.vote || 0,
        createdAt: post.createdAt,
        comments: formatComments(post.comments),
      };
    });

    return NextResponse.json({
      posts: formattedPosts,
    });
  } catch (error) {
    console.error('========================================');
    console.error('[SQUAD_POSTS_GET] Error occurred');
    console.error('[SQUAD_POSTS_GET] Error name:', error.name);
    console.error('[SQUAD_POSTS_GET] Error message:', error.message);
    console.error('[SQUAD_POSTS_GET] Error code:', error.code);
    console.error('[SQUAD_POSTS_GET] Full error:', error);
    console.error('[SQUAD_POSTS_GET] Stack trace:', error.stack);
    console.error('========================================');
    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rescue-squads/[id]/posts
 *
 * Create a new post
 * Requires squad membership
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { title, content, imageUrl, divisionId } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Post content is required' },
        { status: 400 }
      );
    }

    // Check if user is a member of this squad
    const membership = await prisma.rescueSquadMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a squad member to post' },
        { status: 403 }
      );
    }

    // Create post
    const post = await prisma.squadPost.create({
      data: {
        rescueSquadId: id,
        authorId: session.user.id,
        title: title?.trim() || null,
        content: content.trim(),
        imageUrl: imageUrl || null,
        divisionId: divisionId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        authorId: post.authorId,
        authorName: `${post.author.firstName} ${post.author.lastName || ''}`.trim(),
        authorRole: membership.role,
        divisionId: post.divisionId,
        divisionName: post.division?.name,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
        userVote: 0,
        createdAt: post.createdAt,
        comments: [],
      },
    });
  } catch (error) {
    console.error('========================================');
    console.error('[SQUAD_POSTS_POST] Error occurred');
    console.error('[SQUAD_POSTS_POST] Error name:', error.name);
    console.error('[SQUAD_POSTS_POST] Error message:', error.message);
    console.error('[SQUAD_POSTS_POST] Error code:', error.code);
    console.error('[SQUAD_POSTS_POST] Full error:', error);
    console.error('[SQUAD_POSTS_POST] Stack trace:', error.stack);
    console.error('========================================');
    return NextResponse.json(
      {
        error: 'Failed to create post',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
