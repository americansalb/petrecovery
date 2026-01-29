import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/posts/[postId]/comments
 *
 * Add a comment to a post (with optional parent for threading)
 * Body: { content, parentCommentId? }
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

    const { id, postId } = params;
    const body = await request.json();
    const { content, parentCommentId } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
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
        { error: 'You must be a force member to comment' },
        { status: 403 }
      );
    }

    // Check if post exists and belongs to this squad
    const post = await prisma.squadPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        rescueSquadId: true,
        commentCount: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.rescueSquadId !== id) {
      return NextResponse.json(
        { error: 'Post does not belong to this force' },
        { status: 403 }
      );
    }

    // If parentCommentId is provided, verify it exists and belongs to this post
    if (parentCommentId) {
      const parentComment = await prisma.squadPostComment.findUnique({
        where: { id: parentCommentId },
        select: {
          id: true,
          postId: true,
        },
      });

      if (!parentComment || parentComment.postId !== postId) {
        return NextResponse.json(
          { error: 'Invalid parent comment' },
          { status: 400 }
        );
      }
    }

    // Create comment
    const comment = await prisma.squadPostComment.create({
      data: {
        postId,
        authorId: session.user.id,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update post comment count (only for top-level comments)
    if (!parentCommentId) {
      await prisma.squadPost.update({
        where: { id: postId },
        data: {
          commentCount: post.commentCount + 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        authorId: comment.authorId,
        authorName: `${comment.author.firstName} ${comment.author.lastName || ''}`.trim(),
        authorRole: membership.role,
        content: comment.content,
        upvotes: 0,
        downvotes: 0,
        userVote: 0,
        createdAt: comment.createdAt,
        replies: [],
      },
    });
  } catch (error) {
    console.error('[POST_COMMENT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}
