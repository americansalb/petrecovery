import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/comments/[commentId]/vote
 *
 * Vote on a comment (upvote or downvote)
 * Body: { vote: 1 | -1 }
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

    const { id, commentId } = params;
    const body = await request.json();
    const { vote } = body;

    if (vote !== 1 && vote !== -1) {
      return NextResponse.json(
        { error: 'Vote must be 1 (upvote) or -1 (downvote)' },
        { status: 400 }
      );
    }

    // Check if user is a member of this force
    const membership = await prisma.rescueForceMember.findUnique({
      where: {
        userId_rescueForceId: {
          userId: session.user.id,
          rescueForceId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a force member to vote' },
        { status: 403 }
      );
    }

    // Check if comment exists and belongs to this force
    const comment = await prisma.squadPostComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        post: {
          select: {
            rescueForceId: true,
          },
        },
        upvotes: true,
        downvotes: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.post.rescueForceId !== id) {
      return NextResponse.json(
        { error: 'Comment does not belong to this force' },
        { status: 403 }
      );
    }

    // Check if user has already voted
    const existingVote = await prisma.squadCommentVote.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: session.user.id,
        },
      },
    });

    let updatedComment;

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Remove vote (user clicked same button again)
        await prisma.squadCommentVote.delete({
          where: {
            commentId_userId: {
              commentId,
              userId: session.user.id,
            },
          },
        });

        // Update comment counts
        updatedComment = await prisma.squadPostComment.update({
          where: { id: commentId },
          data: {
            upvotes: vote === 1 ? comment.upvotes - 1 : comment.upvotes,
            downvotes: vote === -1 ? comment.downvotes - 1 : comment.downvotes,
          },
        });

        return NextResponse.json({
          success: true,
          vote: 0,
          upvotes: updatedComment.upvotes,
          downvotes: updatedComment.downvotes,
        });
      } else {
        // Change vote (upvote -> downvote or vice versa)
        await prisma.squadCommentVote.update({
          where: {
            commentId_userId: {
              commentId,
              userId: session.user.id,
            },
          },
          data: { vote },
        });

        // Update comment counts
        updatedComment = await prisma.squadPostComment.update({
          where: { id: commentId },
          data: {
            upvotes: vote === 1 ? comment.upvotes + 1 : comment.upvotes - 1,
            downvotes: vote === -1 ? comment.downvotes + 1 : comment.downvotes - 1,
          },
        });

        return NextResponse.json({
          success: true,
          vote,
          upvotes: updatedComment.upvotes,
          downvotes: updatedComment.downvotes,
        });
      }
    } else {
      // Create new vote
      await prisma.squadCommentVote.create({
        data: {
          commentId,
          userId: session.user.id,
          vote,
        },
      });

      // Update comment counts
      updatedComment = await prisma.squadPostComment.update({
        where: { id: commentId },
        data: {
          upvotes: vote === 1 ? comment.upvotes + 1 : comment.upvotes,
          downvotes: vote === -1 ? comment.downvotes + 1 : comment.downvotes,
        },
      });

      return NextResponse.json({
        success: true,
        vote,
        upvotes: updatedComment.upvotes,
        downvotes: updatedComment.downvotes,
      });
    }
  } catch (error) {
    console.error('[COMMENT_VOTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to vote on comment' },
      { status: 500 }
    );
  }
}
