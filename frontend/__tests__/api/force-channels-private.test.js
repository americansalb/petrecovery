/**
 * A Rescue Force's chat and announcements, and a pet's mission chat, are not
 * public.
 *
 * Before this, signed out, anyone could read them: GET /api/rescue-forces/
 * [id]/chat and /announcements answered with every message and its author,
 * /api/rescue-forces/[id]/hub carried both, /api/missions/[id]/chat answered
 * anyone with the case id, and the force's public page printed the latest
 * activity rows (chat included) into its HTML.
 *
 * Also here: sending a force chat message failed every time, because the
 * route wrote a `missionId` that SquadActivity does not have.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    squadActivity: { findMany: jest.fn(), create: jest.fn() },
    rescueForceMember: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    rescueForce: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    caseAssignment: { findMany: jest.fn(), findFirst: jest.fn() },
    squadTask: { findMany: jest.fn() },
    case: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as chatGET, POST as chatPOST } from '@/app/api/rescue-forces/[id]/chat/route';
import { GET as announcementsGET } from '@/app/api/rescue-forces/[id]/announcements/route';
import { GET as hubGET } from '@/app/api/rescue-forces/[id]/hub/route';
import { GET as missionChatGET } from '@/app/api/missions/[missionId]/chat/route';
import { getPublicForce } from '@/app/lib/forcePublic';

const FORCE = 'force-1';
const forceCtx = { params: { id: FORCE } };

// The columns SquadActivity has (prisma/schema.prisma).
const SQUAD_ACTIVITY_FIELDS = ['id', 'rescueSquadId', 'type', 'message', 'details', 'actorId', 'caseId', 'createdAt'];

const CHAT_ROW = {
  id: 'msg-1',
  rescueSquadId: FORCE,
  type: 'CHAT_MESSAGE',
  message: 'Meet at the park at 6',
  details: '{}',
  actorId: 'user-2',
  caseId: null,
  createdAt: new Date('2026-09-01T12:00:00Z'),
  actor: { id: 'user-2', firstName: 'Dana', lastName: 'Smith' },
};

function signedOut() {
  getServerSession.mockResolvedValue(null);
}
function signedIn({ member, admin = false }) {
  getServerSession.mockResolvedValue({ user: { id: 'user-1', firstName: 'Kim', lastName: 'Lee' } });
  prisma.rescueForceMember.findFirst.mockResolvedValue(
    member ? { id: 'm-1', userId: 'user-1', rescueSquadId: FORCE, role: 'MEMBER', isActive: true, divisionId: null } : null
  );
  prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: admin ? 'ADMIN' : 'USER', firstName: 'Kim', lastName: 'Lee' });
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.squadActivity.findMany.mockResolvedValue([CHAT_ROW]);
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  prisma.rescueForceMember.count.mockResolvedValue(0);
  prisma.caseAssignment.findMany.mockResolvedValue([]);
  prisma.squadTask.findMany.mockResolvedValue([]);
  prisma.case.findMany.mockResolvedValue([]);
});

describe('force chat', () => {
  const get = (query = '') => chatGET(new Request(`http://localhost/api/rescue-forces/${FORCE}/chat${query}`), forceCtx);

  test('signed out: 401 and nothing read', async () => {
    signedOut();
    const res = await get();
    expect(res.status).toBe(401);
    expect(prisma.squadActivity.findMany).not.toHaveBeenCalled();
  });

  test('signed in but not a member: 403 and nothing read', async () => {
    signedIn({ member: false });
    const res = await get();
    expect(res.status).toBe(403);
    expect(prisma.squadActivity.findMany).not.toHaveBeenCalled();
  });

  test('a member reads it', async () => {
    signedIn({ member: true });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({ content: 'Meet at the park at 6', authorName: 'Dana S.' });
  });

  test('a platform admin reads it', async () => {
    signedIn({ member: false, admin: true });
    expect((await get()).status).toBe(200);
  });

  test('the case filter uses caseId, and the page size is capped', async () => {
    signedIn({ member: true });
    await get('?missionId=case-9&limit=100000');
    const args = prisma.squadActivity.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ rescueSquadId: FORCE, type: 'CHAT_MESSAGE', caseId: 'case-9' });
    expect(args.take).toBe(100);
  });

  test('sending a message writes only columns SquadActivity has', async () => {
    signedIn({ member: true });
    prisma.squadActivity.create.mockImplementation(async ({ data }) => ({ id: 'msg-2', createdAt: new Date(), ...data }));

    const res = await chatPOST(
      new Request(`http://localhost/api/rescue-forces/${FORCE}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content: 'On my way', missionId: 'case-9' }),
      }),
      forceCtx
    );
    expect(res.status).toBe(200);
    const { data } = prisma.squadActivity.create.mock.calls[0][0];
    expect(Object.keys(data).filter((k) => !SQUAD_ACTIVITY_FIELDS.includes(k))).toEqual([]);
    expect(data).toMatchObject({ rescueSquadId: FORCE, type: 'CHAT_MESSAGE', message: 'On my way', caseId: 'case-9' });
  });
});

describe('force announcements', () => {
  const get = () => announcementsGET(new Request(`http://localhost/api/rescue-forces/${FORCE}/announcements`), forceCtx);

  test('signed out: 401', async () => {
    signedOut();
    expect((await get()).status).toBe(401);
    expect(prisma.squadActivity.findMany).not.toHaveBeenCalled();
  });

  test('not a member: 403', async () => {
    signedIn({ member: false });
    expect((await get()).status).toBe(403);
    expect(prisma.squadActivity.findMany).not.toHaveBeenCalled();
  });

  test('a member reads them', async () => {
    signedIn({ member: true });
    prisma.squadActivity.findMany.mockResolvedValue([{ ...CHAT_ROW, type: 'ANNOUNCEMENT', details: '{"title":"Search Saturday"}' }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).announcements[0]).toMatchObject({ title: 'Search Saturday' });
  });
});

describe('force hub', () => {
  const SQUAD = {
    id: FORCE,
    name: 'Portland Rescue Force',
    city: 'Portland',
    state: 'OR',
    country: 'US',
    divisions: [],
    _count: { members: 3 },
  };
  const get = () => hubGET(new Request(`http://localhost/api/rescue-forces/${FORCE}/hub`), forceCtx);

  beforeEach(() => {
    prisma.rescueForce.findUnique.mockResolvedValue(SQUAD);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => console.log.mockRestore());

  test('signed out: no chat, announcements or requests, and nothing written', async () => {
    signedOut();
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chat.messages).toEqual([]);
    expect(body.announcements).toEqual([]);
    expect(body.requests).toEqual([]);
    expect(prisma.squadTask.findMany).not.toHaveBeenCalled();
    // The welcome post (and its system user) is not created on an anonymous visit.
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    // The one activity query left leaves chat and announcements out.
    const queries = prisma.squadActivity.findMany.mock.calls.map((c) => c[0].where);
    expect(queries).toEqual([{ rescueSquadId: FORCE, type: { notIn: ['CHAT_MESSAGE', 'ANNOUNCEMENT'] } }]);
  });

  test('a member gets the chat', async () => {
    signedIn({ member: true });
    const res = await get();
    const body = await res.json();
    expect(body.membership.isMember).toBe(true);
    expect(body.chat.messages).toHaveLength(1);
    expect(body.chat.messages[0].content).toBe('Meet at the park at 6');
  });
});

describe('mission chat', () => {
  const get = (query = '') =>
    missionChatGET(new Request(`http://localhost/api/missions/case-9/chat${query}`), { params: { missionId: 'case-9' } });

  test('signed out: 401 and nothing read', async () => {
    signedOut();
    const res = await get();
    expect(res.status).toBe(401);
    expect(prisma.squadActivity.findMany).not.toHaveBeenCalled();
  });

  test('signed in: reads it, page size capped', async () => {
    signedIn({ member: false });
    const res = await get('?limit=5000');
    expect(res.status).toBe(200);
    expect((await res.json()).messages).toHaveLength(1);
    expect(prisma.squadActivity.findMany.mock.calls[0][0].take).toBe(200);
  });
});

test('the public force page loads no activity rows', async () => {
  prisma.rescueForce.findFirst.mockResolvedValue(null);
  await getPublicForce(FORCE);
  const { select } = prisma.rescueForce.findFirst.mock.calls[0][0];
  expect(select).not.toHaveProperty('activities');
});
