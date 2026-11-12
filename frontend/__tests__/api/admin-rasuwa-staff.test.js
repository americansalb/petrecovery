/**
 * The two admin routes of the families' pages
 * (/api/admin/rasuwa-letters and /api/admin/rasuwa-team).
 *
 * Both trusted middleware.js alone, and the middleware reads the role out
 * of the sign-in cookie as it stands. The first lists the families' letter
 * records by the missing person's name; the second removes posts, needs
 * and claims from the task force board. Each now asks the database who is
 * staff before it reads or removes anything.
 */

jest.mock('@/app/lib/prisma', () => {
  const table = () => ({ count: jest.fn(async () => 3), deleteMany: jest.fn(async () => ({ count: 1 })) });
  return {
    __esModule: true,
    default: {
      user: { findUnique: jest.fn() },
      rasuwaLetterRecord: { findMany: jest.fn(async () => [{ id: 'r1', personName: 'A person' }]), groupBy: jest.fn(async () => [{ personName: 'A person', _count: { personName: 1 } }]) },
      rasuwaTeamPost: table(),
      rasuwaTeamNeed: table(),
      rasuwaPersonClaim: table(),
    },
  };
});
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as letters } from '@/app/api/admin/rasuwa-letters/route';
import { GET as counts, DELETE as remove } from '@/app/api/admin/rasuwa-team/route';

const readLetters = () => letters(new Request('http://localhost/api/admin/rasuwa-letters'));
const removePost = () => remove(new Request('http://localhost/api/admin/rasuwa-team?type=post&id=p1', { method: 'DELETE' }));

beforeEach(() => {
  jest.clearAllMocks();
  // A session whose cookie says ADMIN. What decides is the database.
  getServerSession.mockResolvedValue({ user: { id: 'u-1', role: 'ADMIN' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
});

describe('a cookie that says ADMIN, for an account the database says is not', () => {
  test('is not shown the letter records', async () => {
    expect((await readLetters()).status).toBe(403);
    expect(prisma.rasuwaLetterRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.rasuwaLetterRecord.groupBy).not.toHaveBeenCalled();
  });

  test('is not told it is an admin, and removes nothing from the board', async () => {
    const probe = await counts();
    expect(probe.status).toBe(403);
    expect(JSON.stringify(await probe.json())).not.toMatch(/"admin":true/);
    expect((await removePost()).status).toBe(403);
    expect(prisma.rasuwaTeamPost.count).not.toHaveBeenCalled();
    expect(prisma.rasuwaTeamPost.deleteMany).not.toHaveBeenCalled();
  });
});

test('nobody signed in: 401, and nothing is read or removed', async () => {
  getServerSession.mockResolvedValue(null);
  expect((await readLetters()).status).toBe(401);
  expect((await counts()).status).toBe(401);
  expect((await removePost()).status).toBe(401);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(prisma.rasuwaTeamPost.deleteMany).not.toHaveBeenCalled();
});

describe('staff, by the database', () => {
  beforeEach(() => prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' }));

  test('read the letter records', async () => {
    const res = await readLetters();
    expect(res.status).toBe(200);
    expect((await res.json()).records).toHaveLength(1);
  });

  test('are told so by the board, and remove a post', async () => {
    const probe = await counts();
    expect(probe.status).toBe(200);
    expect(await probe.json()).toMatchObject({ admin: true, counts: { posts: 3, needs: 3, claims: 3 } });
    const res = await removePost();
    expect(res.status).toBe(200);
    expect(prisma.rasuwaTeamPost.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});
