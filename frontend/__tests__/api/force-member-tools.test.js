/**
 * Rescue Force member tools that could not work.
 *
 * - Division create, edit and delete checked the caller against
 *   prisma.squadMembership, which does not exist, and wrote coverageArea and
 *   createdById, which are not Division columns: every request answered 500.
 *   The single-division read asked for a createdBy relation Division does not
 *   have, and it and the division member list selected members' emails.
 * - Unliking a post or a comment sends vote 0, which the vote routes
 *   rejected with a 400, so a like could never be taken back.
 * - Posting, voting and commenting only checked that a membership row
 *   existed. Leaving a force deactivates the row, so former and removed
 *   members could still write.
 * - The hub mapped case statuses 'RESOLVED' and 'CLOSED', which do not exist,
 *   so a closed case with no resolution recorded showed as live.
 * - The force photo route allowed 'ADMIN' (not a force role) but not LEADER.
 *
 * Prisma is mocked, so the "writes only real columns" checks read the model
 * fields from prisma/schema.prisma.
 */

import fs from 'fs';
import path from 'path';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    division: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    rescueForceMember: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    rescueForce: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    squadPost: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    squadPostVote: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    squadPostComment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    squadCommentVote: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    squadActivity: { findMany: jest.fn(), create: jest.fn() },
    squadTask: { findMany: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    case: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as listDivisions, POST as createDivision } from '@/app/api/rescue-forces/[id]/divisions/route';
import { GET as readDivision, PATCH as editDivision, DELETE as deleteDivision } from '@/app/api/rescue-forces/[id]/divisions/[divisionId]/route';
import { GET as divisionMembers, POST as addDivisionMember } from '@/app/api/rescue-forces/[id]/divisions/[divisionId]/members/route';
import { DELETE as removeDivisionMember } from '@/app/api/rescue-forces/[id]/divisions/[divisionId]/members/[memberId]/route';
import { POST as createPost } from '@/app/api/rescue-forces/[id]/posts/route';
import { POST as votePost } from '@/app/api/rescue-forces/[id]/posts/[postId]/vote/route';
import { POST as comment } from '@/app/api/rescue-forces/[id]/posts/[postId]/comments/route';
import { POST as voteComment } from '@/app/api/rescue-forces/[id]/comments/[commentId]/vote/route';
import { GET as hub } from '@/app/api/rescue-forces/[id]/hub/route';
import { POST as setPhoto } from '@/app/api/rescue-forces/[id]/photo/route';

const FORCE = 'force-1';

function modelFields(model) {
  const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const body = schema.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm'))[1];
  return body
    .split('\n')
    .map((line) => line.trim().match(/^([a-zA-Z]\w*)\s+\S/))
    .filter(Boolean)
    .map((m) => m[1]);
}

const unknownKeys = (data, model) => Object.keys(data).filter((k) => !modelFields(model).includes(k));

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });
const req = (url, init) => new Request(`http://localhost${url}`, init);

function signedInAs(role, { active = true } = {}) {
  getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  const membership = role ? { id: 'm-1', userId: 'user-1', rescueSquadId: FORCE, role, isActive: active, divisionId: null } : null;
  // Leader checks filter by role in the query; answer as the database would.
  prisma.rescueForceMember.findFirst.mockImplementation(async ({ where }) => {
    if (!membership || !membership.isActive) return null;
    if (where.id && where.id !== 'm-1') return { id: where.id, role: 'MEMBER', rescueSquadId: FORCE, isActive: true, divisionId: where.divisionId || null };
    const roles = where.role?.in;
    return roles && !roles.includes(membership.role) ? null : membership;
  });
  prisma.rescueForceMember.findUnique.mockResolvedValue(membership);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('divisions', () => {
  const ctx = { params: { id: FORCE } };
  const divisionCtx = { params: { id: FORCE, divisionId: 'div-1' } };

  test('a leader creates one, writing only Division columns', async () => {
    signedInAs('LEADER');
    prisma.division.findFirst.mockResolvedValue(null);
    prisma.division.create.mockImplementation(async ({ data }) => ({ id: 'div-new', createdAt: new Date(), ...data }));

    const res = await createDivision(req(`/api/rescue-forces/${FORCE}/divisions`, json({ name: ' North ', description: 'North of the river', coverageArea: 'ignored' })), ctx);
    expect(res.status).toBe(200);
    const { data } = prisma.division.create.mock.calls[0][0];
    expect(unknownKeys(data, 'Division')).toEqual([]);
    expect(data).toEqual({ name: 'North', description: 'North of the river', rescueSquadId: FORCE });
  });

  test('a member cannot create one', async () => {
    signedInAs('MEMBER');
    const res = await createDivision(req(`/api/rescue-forces/${FORCE}/divisions`, json({ name: 'North' })), ctx);
    expect(res.status).toBe(403);
    expect(prisma.division.create).not.toHaveBeenCalled();
  });

  test('an active division with the name is a duplicate', async () => {
    signedInAs('FOUNDER');
    prisma.division.findFirst.mockResolvedValue({ id: 'div-1', isActive: true, isDeleted: false });
    const res = await createDivision(req(`/api/rescue-forces/${FORCE}/divisions`, json({ name: 'North' })), ctx);
    expect(res.status).toBe(400);
  });

  test('a deleted division with the name comes back instead of failing', async () => {
    signedInAs('FOUNDER');
    prisma.division.findFirst.mockResolvedValue({ id: 'div-old', isActive: false, isDeleted: true });
    prisma.division.update.mockImplementation(async ({ data }) => ({ id: 'div-old', createdAt: new Date(), ...data }));
    const res = await createDivision(req(`/api/rescue-forces/${FORCE}/divisions`, json({ name: 'North' })), ctx);
    expect(res.status).toBe(200);
    expect(prisma.division.create).not.toHaveBeenCalled();
    const { where, data } = prisma.division.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'div-old' });
    expect(data).toMatchObject({ name: 'North', isActive: true, isDeleted: false, deletedAt: null });
    expect(unknownKeys(data, 'Division')).toEqual([]);
  });

  test('the list is public, so leaders are shown by first name', async () => {
    prisma.division.findMany.mockResolvedValue([]);
    await listDivisions(req(`/api/rescue-forces/${FORCE}/divisions`), ctx);
    const args = prisma.division.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ rescueSquadId: FORCE, isActive: true, isDeleted: false });
    expect(args.include.members.include.user.select).toEqual({ id: true, firstName: true });
  });

  test('a leader edits one, writing only Division columns', async () => {
    signedInAs('LEADER');
    prisma.division.findFirst.mockResolvedValueOnce({ id: 'div-1', name: 'North', description: null }).mockResolvedValueOnce(null);
    prisma.division.update.mockImplementation(async ({ data }) => ({ id: 'div-1', _count: { members: 0 }, ...data }));
    const res = await editDivision(req(`/api/rescue-forces/${FORCE}/divisions/div-1`, { method: 'PATCH', body: JSON.stringify({ name: 'Northside', description: 'Up top' }) }), divisionCtx);
    expect(res.status).toBe(200);
    expect(unknownKeys(prisma.division.update.mock.calls[0][0].data, 'Division')).toEqual([]);
  });

  test("renaming onto a deleted division's name is a clear 400, not a crash", async () => {
    signedInAs('LEADER');
    prisma.division.findFirst
      .mockResolvedValueOnce({ id: 'div-1', name: 'North', description: null })
      .mockResolvedValueOnce({ id: 'div-old', isActive: false, isDeleted: true });
    const res = await editDivision(req(`/api/rescue-forces/${FORCE}/divisions/div-1`, { method: 'PATCH', body: JSON.stringify({ name: 'South' }) }), divisionCtx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/deleted division/);
    expect(prisma.division.update).not.toHaveBeenCalled();
  });

  test('a leader deletes one and its members are unassigned', async () => {
    signedInAs('LEADER');
    prisma.division.findFirst.mockResolvedValue({ id: 'div-1', name: 'North' });
    const res = await deleteDivision(req(`/api/rescue-forces/${FORCE}/divisions/div-1`, { method: 'DELETE' }), divisionCtx);
    expect(res.status).toBe(200);
    expect(prisma.division.update.mock.calls[0][0].data).toMatchObject({ isActive: false, isDeleted: true });
    expect(prisma.rescueForceMember.updateMany).toHaveBeenCalledWith({ where: { divisionId: 'div-1' }, data: { divisionId: null } });
  });

  test('reading one asks only for real relations and no emails', async () => {
    prisma.division.findFirst.mockResolvedValue(null);
    await readDivision(req(`/api/rescue-forces/${FORCE}/divisions/div-1`), divisionCtx);
    const { include } = prisma.division.findFirst.mock.calls[0][0];
    expect(include).not.toHaveProperty('createdBy');
    expect(include.members.include.user.select).toEqual({ id: true, firstName: true });
  });

  test('the division member list has no emails', async () => {
    prisma.division.findFirst.mockResolvedValue(null);
    await divisionMembers(req(`/api/rescue-forces/${FORCE}/divisions/div-1/members`), divisionCtx);
    expect(prisma.division.findFirst.mock.calls[0][0].include.members.include.user.select).toEqual({ id: true, firstName: true });
  });

  test('a leader assigns and unassigns a member', async () => {
    signedInAs('LEADER');
    prisma.division.findFirst.mockResolvedValue({ id: 'div-1' });
    let res = await addDivisionMember(req(`/api/rescue-forces/${FORCE}/divisions/div-1/members`, json({ memberId: 'm-2' })), divisionCtx);
    expect(res.status).toBe(200);
    expect(prisma.rescueForceMember.update).toHaveBeenCalledWith({ where: { id: 'm-2' }, data: { divisionId: 'div-1' } });

    res = await removeDivisionMember(req(`/api/rescue-forces/${FORCE}/divisions/div-1/members/m-2`, { method: 'DELETE' }), { params: { id: FORCE, divisionId: 'div-1', memberId: 'm-2' } });
    expect(res.status).toBe(200);
    expect(prisma.rescueForceMember.update).toHaveBeenLastCalledWith({ where: { id: 'm-2' }, data: { divisionId: null } });
  });
});

describe('posts, comments and likes', () => {
  const postCtx = { params: { id: FORCE, postId: 'post-1' } };
  const commentCtx = { params: { id: FORCE, commentId: 'c-1' } };

  test('a former member cannot post, comment or like', async () => {
    signedInAs('MEMBER', { active: false });
    expect((await createPost(req(`/api/rescue-forces/${FORCE}/posts`, json({ content: 'hi' })), { params: { id: FORCE } })).status).toBe(403);
    expect((await comment(req(`/api/rescue-forces/${FORCE}/posts/post-1/comments`, json({ content: 'hi' })), postCtx)).status).toBe(403);
    expect((await votePost(req(`/api/rescue-forces/${FORCE}/posts/post-1/vote`, json({ vote: 1 })), postCtx)).status).toBe(403);
    expect((await voteComment(req(`/api/rescue-forces/${FORCE}/comments/c-1/vote`, json({ vote: 1 })), commentCtx)).status).toBe(403);
    expect(prisma.squadPost.create).not.toHaveBeenCalled();
    expect(prisma.squadPostComment.create).not.toHaveBeenCalled();
    expect(prisma.squadPostVote.create).not.toHaveBeenCalled();
  });

  test("a post can't be tagged with another force's division", async () => {
    signedInAs('MEMBER');
    prisma.division.findFirst.mockResolvedValue(null);
    const res = await createPost(req(`/api/rescue-forces/${FORCE}/posts`, json({ content: 'hi', divisionId: 'someone-elses' })), { params: { id: FORCE } });
    expect(res.status).toBe(400);
    expect(prisma.squadPost.create).not.toHaveBeenCalled();
  });

  test('unliking a post takes the like back', async () => {
    signedInAs('MEMBER');
    prisma.squadPost.findUnique.mockResolvedValue({ id: 'post-1', rescueSquadId: FORCE, upvotes: 3, downvotes: 0 });
    prisma.squadPostVote.findUnique.mockResolvedValue({ vote: 1 });
    prisma.squadPost.update.mockResolvedValue({ upvotes: 2, downvotes: 0 });

    const res = await votePost(req(`/api/rescue-forces/${FORCE}/posts/post-1/vote`, json({ vote: 0 })), postCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ vote: 0, upvotes: 2 });
    expect(prisma.squadPostVote.delete).toHaveBeenCalled();
    expect(prisma.squadPost.update.mock.calls[0][0].data).toEqual({ upvotes: { decrement: 1 } });
  });

  test('unliking a post you never liked changes nothing', async () => {
    signedInAs('MEMBER');
    prisma.squadPost.findUnique.mockResolvedValue({ id: 'post-1', rescueSquadId: FORCE, upvotes: 3, downvotes: 0 });
    prisma.squadPostVote.findUnique.mockResolvedValue(null);
    const res = await votePost(req(`/api/rescue-forces/${FORCE}/posts/post-1/vote`, json({ vote: 0 })), postCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ vote: 0, upvotes: 3 });
    expect(prisma.squadPostVote.delete).not.toHaveBeenCalled();
    expect(prisma.squadPost.update).not.toHaveBeenCalled();
  });

  test('unliking a comment takes the like back', async () => {
    signedInAs('MEMBER');
    prisma.squadPostComment.findUnique.mockResolvedValue({ id: 'c-1', post: { rescueSquadId: FORCE }, upvotes: 1, downvotes: 0 });
    prisma.squadCommentVote.findUnique.mockResolvedValue({ vote: 1 });
    prisma.squadPostComment.update.mockResolvedValue({ upvotes: 0, downvotes: 0 });
    const res = await voteComment(req(`/api/rescue-forces/${FORCE}/comments/c-1/vote`, json({ vote: 0 })), commentCtx);
    expect(res.status).toBe(200);
    expect(prisma.squadCommentVote.delete).toHaveBeenCalled();
    expect(prisma.squadPostComment.update.mock.calls[0][0].data).toEqual({ upvotes: { decrement: 1 } });
  });

  test('any other vote value is still refused', async () => {
    signedInAs('MEMBER');
    const res = await votePost(req(`/api/rescue-forces/${FORCE}/posts/post-1/vote`, json({ vote: 5 })), postCtx);
    expect(res.status).toBe(400);
  });
});

describe('hub case statuses', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    getServerSession.mockResolvedValue(null);
    prisma.rescueForce.findUnique.mockResolvedValue({ id: FORCE, name: 'Austin Rescue Force', city: 'Austin', divisions: [], _count: { members: 1 } });
    prisma.rescueForceMember.findMany.mockResolvedValue([]);
    prisma.rescueForceMember.count.mockResolvedValue(0);
    prisma.squadActivity.findMany.mockResolvedValue([]);
    prisma.case.findMany.mockResolvedValue([]);
  });
  afterEach(() => console.log.mockRestore());

  const assignment = (c, status = 'ACTIVE') => ({ id: `a-${c.id}`, status, participants: [], case: { lastSeenAt: new Date(), ...c } });

  test('closed and reunited cases are not shown as live', async () => {
    prisma.caseAssignment.findMany.mockResolvedValue([
      assignment({ id: 'c1', status: 'CLOSED_OTHER', resolution: null }),
      assignment({ id: 'c2', status: 'REUNITED', resolution: null }),
      assignment({ id: 'c3', status: 'ACTIVE', resolution: 'CAME_HOME' }),
      assignment({ id: 'c4', status: 'IN_PROGRESS', resolution: null }),
    ]);
    const res = await hub(req(`/api/rescue-forces/${FORCE}/hub`), { params: { id: FORCE } });
    const statuses = Object.fromEntries((await res.json()).cases.map((c) => [c.id, c.status]));
    expect(statuses).toEqual({ c1: 'CLOSED_OTHER', c2: 'REUNITED', c3: 'REUNITED', c4: 'IN_PROGRESS' });
  });
});

describe('force photo', () => {
  const setPhotoReq = () => setPhoto(req(`/api/rescue-forces/${FORCE}/photo`, json({ photoUrl: 'https://cdn.example/photo.jpg' })), { params: { id: FORCE } });

  test.each(['FOUNDER', 'LEADER'])('a %s can change it', async (role) => {
    signedInAs(role);
    prisma.rescueForce.update.mockResolvedValue({ photoUrl: 'https://cdn.example/photo.jpg' });
    expect((await setPhotoReq()).status).toBe(200);
  });

  test('a member cannot', async () => {
    signedInAs('MEMBER');
    expect((await setPhotoReq()).status).toBe(403);
    expect(prisma.rescueForce.update).not.toHaveBeenCalled();
  });
});
