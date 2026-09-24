import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/posts/[postId]/vote
 *
 * Vote on a post (upvote or downvote)
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

    const { id, postId } = params;
    const body = await request.json();
    const { vote } = body;

    // 0 takes a vote back. The like button sends it to unlike, and this
    // route used to answer 400, so a like could never be undone.
    if (vote !== 1 && vote !== -1 && vote !== 0) {
      return NextResponse.json(
        { error: 'Vote must be 1 (upvote), -1 (downvote) or 0 (remove)' },
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
    // let former and removed members keep voting.
    if (!membership?.isActive) {
      return NextResponse.json(
        { error: 'You must be a rescue force member to vote' },
        { status: 403 }
      );
    }

    // Check if post exists and belongs to this squad
    const post = await prisma.squadPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        rescueSquadId: true,
        upvotes: true,
        downvotes: true,
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
        { error: 'Post does not belong to this rescue force' },
        { status: 403 }
      );
    }

    // Check if user has already voted
    const existingVote = await prisma.squadPostVote.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: session.user.id,
        },
      },
    });

    let updatedPost;

    if (vote === 0) {
      if (existingVote) {
        await prisma.squadPostVote.delete({
          where: { postId_userId: { postId, userId: session.user.id } },
        });
        updatedPost = await prisma.squadPost.update({
          where: { id: postId },
          data: existingVote.vote === 1 ? { upvotes: { decrement: 1 } } : { downvotes: { decrement: 1 } },
        });
      }
      return NextResponse.json({
        success: true,
        vote: 0,
        upvotes: (updatedPost || post).upvotes,
        downvotes: (updatedPost || post).downvotes,
      });
    }

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Remove vote (user clicked same button again)
        await prisma.squadPostVote.delete({
          where: {
            postId_userId: {
              postId,
              userId: session.user.id,
            },
          },
        });

        // Update post counts
        updatedPost = await prisma.squadPost.update({
          where: { id: postId },
          data: {
            upvotes: vote === 1 ? post.upvotes - 1 : post.upvotes,
            downvotes: vote === -1 ? post.downvotes - 1 : post.downvotes,
          },
        });

        return NextResponse.json({
          success: true,
          vote: 0,
          upvotes: updatedPost.upvotes,
          downvotes: updatedPost.downvotes,
        });
      } else {
        // Change vote (upvote -> downvote or vice versa)
        await prisma.squadPostVote.update({
          where: {
            postId_userId: {
              postId,
              userId: session.user.id,
            },
          },
          data: { vote },
        });

        // Update post counts
        updatedPost = await prisma.squadPost.update({
          where: { id: postId },
          data: {
            upvotes: vote === 1 ? post.upvotes + 1 : post.upvotes - 1,
            downvotes: vote === -1 ? post.downvotes + 1 : post.downvotes - 1,
          },
        });

        return NextResponse.json({
          success: true,
          vote,
          upvotes: updatedPost.upvotes,
          downvotes: updatedPost.downvotes,
        });
      }
    } else {
      // Create new vote
      await prisma.squadPostVote.create({
        data: {
          postId,
          userId: session.user.id,
          vote,
        },
      });

      // Update post counts
      updatedPost = await prisma.squadPost.update({
        where: { id: postId },
        data: {
          upvotes: vote === 1 ? post.upvotes + 1 : post.upvotes,
          downvotes: vote === -1 ? post.downvotes + 1 : post.downvotes,
        },
      });

      return NextResponse.json({
        success: true,
        vote,
        upvotes: updatedPost.upvotes,
        downvotes: updatedPost.downvotes,
      });
    }
  } catch (error) {
    console.error('[POST_VOTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to vote on post' },
      { status: 500 }
    );
  }
}
