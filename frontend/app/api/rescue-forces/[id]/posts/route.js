import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';
import { memberName } from '@/app/lib/forceRoles';
import { POST_TOPICS, checkPostFields, PostInputError } from '@/app/lib/forceDiscussion';
import { caseStatus, caseTitle } from '@/app/lib/caseLabels';
import { placeName } from '@/app/lib/needOptions';
import { kindOf, petLine } from '@/app/lib/forceFeed';

const PAGE = 20;
// A case number in an older automatic post's text ("Case #AUS-2026-HXEN47").
const CASE_NUMBER_IN_TEXT = /#?\b([A-Z]{3,4}-\d{4}-[0-9A-Z]{4,6})\b/;

/**
 * GET /api/rescue-forces/[id]/posts
 *
 * The force's Discussion feed, newest first, 20 at a time.
 * Query params:
 *  - sort: 'hot' | 'new' | 'top' (default: 'hot')
 *  - divisionId: filter by division (optional)
 *  - topic: SIGHTING | SEARCH_PARTY | QUESTION | FLYERS | HELLO (optional)
 *  - caseId: posts about one pet (optional)
 *  - before: an ISO time; posts older than it ("Show older posts")
 *  - upcoming=1: search parties still to come, soonest first
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'hot';
    const divisionId = searchParams.get('divisionId');
    const topic = POST_TOPICS[searchParams.get('topic')] ? searchParams.get('topic') : null;
    const caseId = searchParams.get('caseId') || null;
    const before = searchParams.get('before') ? new Date(searchParams.get('before')) : null;
    const upcoming = searchParams.get('upcoming') === '1';

    // Build where clause
    const where = {
      rescueSquadId: id,
      isDeleted: false,
      ...(divisionId && { divisionId }),
      ...(topic && { topic }),
      ...(caseId && { caseId }),
      ...(before && !Number.isNaN(before.getTime()) && { createdAt: { lt: before } }),
      ...(upcoming && { topic: 'SEARCH_PARTY', eventAt: { gte: new Date() } }),
    };

    // Determine sorting
    let orderBy;
    if (upcoming) {
      orderBy = { eventAt: 'asc' };
    } else if (sort === 'new') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'top') {
      orderBy = { upvotes: 'desc' };
    } else {
      // Hot: combination of upvotes and recency
      // For now, just sort by creation time with upvotes as secondary
      orderBy = [{ createdAt: 'desc' }];
    }

    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;

    // SEC-12: squad posts are operational coordination (can hold owner PII,
    // addresses, search plans) → member-private. Only an active member or an
    // admin may read the feed. A public community face, if wanted, is a separate
    // curated PII-free surface, not this raw operational feed.
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const membership = await prisma.rescueForceMember.findFirst({
      where: { rescueSquadId: id, userId: currentUserId, isActive: true },
      select: { id: true },
    });
    if (!membership && !(await isAdmin(currentUserId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch posts with author and vote information
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
      take: PAGE + 1,
    });
    const hasMore = posts.length > PAGE;
    if (hasMore) posts.pop();

    // The pet each post is about, and who is going to each search party.
    // An older automatic post named the pet only by its case number in the
    // text; it gets its pet from that, so it draws as a pet card too.
    const postIds = posts.map((p) => p.id);
    const numberIn = (p) => (!p.caseId && kindOf(p) ? (p.content || '').match(CASE_NUMBER_IN_TEXT)?.[1] || null : null);
    const caseIds = [...new Set(posts.map((p) => p.caseId).filter(Boolean))];
    const numbers = [...new Set(posts.map(numberIn).filter(Boolean))];
    const [cases, going, goingCounts] = await Promise.all([
      caseIds.length || numbers.length
        ? prisma.case.findMany({
            where: { OR: [{ id: { in: caseIds } }, { caseNumber: { in: numbers } }] },
            select: {
              id: true,
              caseNumber: true,
              status: true,
              reportType: true,
              resolution: true,
              petName: true,
              petSpecies: true,
              petBreed: true,
              petColor: true,
              petPhotoUrl: true,
              lastSeenAddress: true,
              lastSeenAt: true,
              resolvedAt: true,
            },
          })
        : [],
      postIds.length
        ? prisma.squadPostGoing.findMany({
            where: { postId: { in: postIds } },
            orderBy: { createdAt: 'asc' },
            select: { postId: true, userId: true, user: { select: { firstName: true } } },
          })
        : [],
      postIds.length ? prisma.squadPostGoing.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } }) : [],
    ]);
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const caseByNumber = new Map(cases.map((c) => [c.caseNumber, c]));
    const goingCount = new Map(goingCounts.map((g) => [g.postId, g._count._all]));

    // Get author roles
    const authorIds = posts.map(p => p.authorId);
    const memberships = await prisma.rescueForceMember.findMany({
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
          authorName: memberName(comment.author),
          authorRole: roleMap.get(comment.authorId) || 'MEMBER',
          content: comment.content,
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          userVote: comment.votes?.[0]?.vote || 0,
          createdAt: comment.createdAt,
          replies: comment.replies ? formatComments(comment.replies) : [],
        }));
      };

      const pet = (post.caseId ? caseById.get(post.caseId) : caseByNumber.get(numberIn(post))) || null;
      const goingHere = going.filter((g) => g.postId === post.id);
      return {
        id: post.id,
        authorId: post.authorId,
        authorName: memberName(post.author),
        authorRole: roleMap.get(post.authorId) || 'MEMBER',
        divisionId: post.divisionId,
        divisionName: post.division?.name,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        topic: post.topic || null,
        pet: pet
          ? {
              id: pet.id,
              name: caseTitle(pet),
              caseNumber: pet.caseNumber,
              photo: pet.petPhotoUrl || null,
              status: caseStatus(pet).key,
              species: pet.petSpecies || null,
              // For the feed's pet cards: what it looks like, where, since when.
              line: petLine(pet),
              near: placeName(pet.lastSeenAddress),
              since: pet.lastSeenAt || null,
              home: pet.resolvedAt || null,
            }
          : null,
        // The force's automatic post about the pet, or null for a member's own.
        kind: kindOf(post),
        eventAt: post.eventAt || null,
        eventPlace: post.eventPlace || null,
        goingCount: goingCount.get(post.id) || 0,
        goingNames: goingHere.slice(0, 5).map((g) => (g.user?.firstName || '').trim() || 'A member'),
        iAmGoing: goingHere.some((g) => g.userId === currentUserId),
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
      hasMore,
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
 * POST /api/rescue-forces/[id]/posts
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

    // A search party says enough with its time and place.
    if (!content?.trim() && String(body.topic || '').toUpperCase() !== 'SEARCH_PARTY') {
      return NextResponse.json(
        { error: 'Post content is required' },
        { status: 400 }
      );
    }

    // Check if user is a member of this squad
    const membership = await prisma.rescueForceMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: id,
          userId: session.user.id,
        },
      },
    });

    // Leaving a force only deactivates the membership row, so the row alone
    // let former and removed members keep posting.
    if (!membership?.isActive) {
      return NextResponse.json(
        { error: 'You must be a rescue force member to post' },
        { status: 403 }
      );
    }

    // A division tag has to be one of this force's divisions.
    if (divisionId) {
      const division = await prisma.division.findFirst({
        where: { id: divisionId, rescueSquadId: id, isActive: true },
        select: { id: true },
      });
      if (!division) {
        return NextResponse.json({ error: 'That division is not part of this rescue force' }, { status: 400 });
      }
    }

    // What it is about, which pet, and a search party's time and place.
    let fields;
    try {
      fields = await checkPostFields(id, body);
    } catch (e) {
      if (e instanceof PostInputError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    // Create post
    const post = await prisma.squadPost.create({
      data: {
        rescueSquadId: id,
        authorId: session.user.id,
        title: title?.trim() || null,
        content: (content || '').trim(),
        imageUrl: imageUrl || null,
        divisionId: divisionId || null,
        ...fields,
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
        authorName: memberName(post.author),
        authorRole: membership.role,
        divisionId: post.divisionId,
        divisionName: post.division?.name,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        topic: post.topic,
        eventAt: post.eventAt,
        eventPlace: post.eventPlace,
        goingCount: 0,
        goingNames: [],
        iAmGoing: false,
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
