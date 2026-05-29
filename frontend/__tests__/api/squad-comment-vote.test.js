/**
 * COM-1 regression — squad comment vote flow.
 *
 * The bug: the membership lookup used the wrong composite-key accessor
 * (userId_rescueSquadId instead of the generated rescueSquadId_userId), so every
 * vote 500'd on a Prisma validation error. Fixed.
 *
 * NOTE ON SCOPE: prisma is mocked here, so this locks the route's auth /
 * validation / persist FLOW (401/400/403/404 + create-on-new-vote), NOT the
 * composite-key string itself — a mock can't enforce Prisma's schema. The
 * key-name drift is only catchable against a real client; that's what the
 * proposed ephemeral-DB route smoke test (Pattern 4) is for. This test still
 * guards the flow against logic regressions.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueSquadMember: { findUnique: jest.fn() },
    squadPostComment: { findUnique: jest.fn(), update: jest.fn() },
    squadCommentVote: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import { POST } from '@/app/api/rescue-squads/[id]/comments/[commentId]/vote/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

const PARAMS = { params: { id: 'squad-1', commentId: 'c-1' } };

function vote(body) {
  return POST(
    new NextRequest('http://localhost:3000/api/rescue-squads/squad-1/comments/c-1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    PARAMS
  );
}

describe('POST squad comment vote (COM-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'member-1' } });
    prisma.rescueSquadMember.findUnique.mockResolvedValue({ id: 'm-1' }); // is a member
    prisma.squadPostComment.findUnique.mockResolvedValue({
      id: 'c-1', post: { rescueSquadId: 'squad-1' }, upvotes: 2, downvotes: 0,
    });
    prisma.squadCommentVote.findUnique.mockResolvedValue(null); // no prior vote
    prisma.squadCommentVote.create.mockResolvedValue({});
    prisma.squadPostComment.update.mockResolvedValue({ upvotes: 3, downvotes: 0 });
  });

  test('401 when unauthenticated', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await vote({ vote: 1 })).status).toBe(401);
  });

  test('400 on an invalid vote value', async () => {
    expect((await vote({ vote: 2 })).status).toBe(400);
  });

  test('403 when the user is not a squad member', async () => {
    prisma.rescueSquadMember.findUnique.mockResolvedValue(null);
    expect((await vote({ vote: 1 })).status).toBe(403);
  });

  test('404 when the comment does not exist', async () => {
    prisma.squadPostComment.findUnique.mockResolvedValue(null);
    expect((await vote({ vote: 1 })).status).toBe(404);
  });

  test('403 when the comment belongs to a different squad', async () => {
    prisma.squadPostComment.findUnique.mockResolvedValue({
      id: 'c-1', post: { rescueSquadId: 'OTHER-squad' }, upvotes: 0, downvotes: 0,
    });
    expect((await vote({ vote: 1 })).status).toBe(403);
  });

  test('a member upvoting persists the vote and returns 200', async () => {
    const res = await vote({ vote: 1 });
    expect(res.status).toBe(200);
    expect(prisma.squadCommentVote.create).toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.upvotes).toBe(3);
  });
});
