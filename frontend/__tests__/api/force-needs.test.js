/**
 * Taking, dropping and finishing a Rescue Force's needs
 * (POST /api/rescue-forces/[id]/needs/[needId], app/lib/forceNeeds.js).
 *
 * The task endpoints before this either kept one person per task
 * (/api/tasks/[id]/claim) or never recorded a finished task at all (the
 * mission tasks route answered "complete" with points and saved nothing).
 * A need asks for a number of people; each one takes it, and it closes
 * when that many have marked it done.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForce: { findFirst: jest.fn() },
    rescueForceMember: { findFirst: jest.fn() },
    squadTask: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(async (a) => a) },
    taskParticipant: { upsert: jest.fn(async (a) => a), update: jest.fn(async (a) => a) },
    squadActivity: { create: jest.fn(async (a) => a), findMany: jest.fn() },
    case: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (ops) => Promise.all(ops)),
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/rescue-forces/[id]/needs/[needId]/route';
import { GET } from '@/app/api/rescue-forces/[id]/needs/route';

const FORCE = 'force-austin';
const need = (over = {}) => ({
  id: 'need-1',
  title: 'Put up flyers west of Lamar',
  status: 'AVAILABLE',
  caseId: 'case-max',
  peopleNeeded: 1,
  participants: [],
  ...over,
});

function post(action, needId = 'need-1') {
  return POST(
    new Request(`http://localhost/api/rescue-forces/${FORCE}/needs/${needId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id: FORCE, needId }) }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
  prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike' });
});

describe('who may act', () => {
  test('signed out, not a member, another force, a finished need, a made-up action', async () => {
    getServerSession.mockResolvedValueOnce(null);
    expect((await post('take')).status).toBe(401);

    prisma.squadTask.findFirst.mockResolvedValue(need());
    prisma.rescueForceMember.findFirst.mockResolvedValueOnce(null);
    expect((await post('take')).status).toBe(403);

    prisma.squadTask.findFirst.mockResolvedValue(null);
    expect((await post('take')).status).toBe(404);
    // The need is looked up inside this force, never across forces.
    expect(prisma.squadTask.findFirst.mock.calls.at(-1)[0].where).toMatchObject({ id: 'need-1', rescueSquadId: FORCE });

    prisma.squadTask.findFirst.mockResolvedValue(need({ status: 'COMPLETED' }));
    expect((await post('take')).status).toBe(409);

    expect((await post('steal')).status).toBe(400);
    expect(prisma.taskParticipant.upsert).not.toHaveBeenCalled();
  });
});

describe('take', () => {
  test('puts the member on it and marks it started', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(need());
    const res = await post('take');
    expect(await res.json()).toEqual({ mine: 'on', closed: false });
    expect(prisma.taskParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId_userId: { taskId: 'need-1', userId: 'u-mike' } },
        create: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
    expect(prisma.squadTask.update).toHaveBeenCalledWith({ where: { id: 'need-1' }, data: { status: 'IN_PROGRESS' } });
  });

  test('refused when enough people are on it; taking it twice is fine', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(need({ participants: [{ userId: 'u-sarah', status: 'ACTIVE' }] }));
    const full = await post('take');
    expect(full.status).toBe(409);
    expect((await full.json()).error).toMatch(/Enough people/);

    prisma.squadTask.findFirst.mockResolvedValue(
      need({ peopleNeeded: 3, participants: [{ userId: 'u-mike', status: 'ACTIVE' }, { userId: 'u-sarah', status: 'LEFT' }] })
    );
    expect(await (await post('take')).json()).toEqual({ mine: 'on', closed: false });
    expect(prisma.taskParticipant.upsert).not.toHaveBeenCalled();
  });
});

describe('drop', () => {
  test('the last one out opens the need again', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(need({ participants: [{ userId: 'u-mike', status: 'ACTIVE' }] }));
    expect(await (await post('drop')).json()).toEqual({ mine: null, closed: false });
    expect(prisma.taskParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'LEFT' }) })
    );
    expect(prisma.squadTask.update).toHaveBeenCalledWith({ where: { id: 'need-1' }, data: { status: 'AVAILABLE' } });
  });

  test('others still on it: the need stays started', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(
      need({ peopleNeeded: 2, participants: [{ userId: 'u-mike', status: 'ACTIVE' }, { userId: 'u-sarah', status: 'ACTIVE' }] })
    );
    await post('drop');
    expect(prisma.squadTask.update).not.toHaveBeenCalled();
  });
});

describe('done', () => {
  test('closes a one-person need and says so in the recent activity', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(need({ participants: [{ userId: 'u-mike', status: 'ACTIVE' }] }));
    expect(await (await post('done')).json()).toEqual({ mine: 'done', closed: true });
    expect(prisma.squadTask.update).toHaveBeenCalledWith({
      where: { id: 'need-1' },
      data: expect.objectContaining({ status: 'COMPLETED', completedById: 'u-mike' }),
    });
    expect(prisma.squadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rescueSquadId: FORCE,
        type: 'NEED_DONE',
        details: 'Put up flyers west of Lamar',
        message: 'Mike finished: Put up flyers west of Lamar',
        actorId: 'u-mike',
        caseId: 'case-max',
      }),
    });
  });

  test('a need for three stays open after the first one is done', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(
      need({ peopleNeeded: 3, participants: [{ userId: 'u-mike', status: 'ACTIVE' }, { userId: 'u-sarah', status: 'COMPLETED' }] })
    );
    expect(await (await post('done')).json()).toEqual({ mine: 'done', closed: false });
    expect(prisma.squadTask.update).toHaveBeenCalledWith({ where: { id: 'need-1' }, data: { status: 'IN_PROGRESS' } });
  });

  test('done in one step when there is room; refused when there is not', async () => {
    prisma.squadTask.findFirst.mockResolvedValue(need());
    expect(await (await post('done')).json()).toEqual({ mine: 'done', closed: true });

    jest.clearAllMocks();
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'member-mike' });
    prisma.squadTask.findFirst.mockResolvedValue(need({ participants: [{ userId: 'u-sarah', status: 'ACTIVE' }] }));
    expect((await post('done')).status).toBe(409);
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/rescue-forces/[id]/needs', () => {
  const get = () => GET(new Request(`http://localhost/api/rescue-forces/${FORCE}/needs`), { params: Promise.resolve({ id: FORCE }) });

  beforeEach(() => {
    prisma.rescueForce.findFirst.mockResolvedValue({ id: FORCE });
    prisma.squadTask.findMany.mockResolvedValue([
      {
        id: 'need-1',
        title: 'Search the greenbelt',
        description: 'Meet at the trailhead',
        caseId: null,
        peopleNeeded: 2,
        ownerRequested: false,
        ownerRequestedHelp: false,
        createdAt: new Date(),
        participants: [{ userId: 'u-mike', status: 'ACTIVE' }],
      },
    ]);
    prisma.case.findMany.mockResolvedValue([]);
    prisma.squadActivity.findMany.mockResolvedValue([]);
  });

  test('anyone sees what is needed; a member also sees the notes and their place', async () => {
    getServerSession.mockResolvedValue(null);
    const visitor = await (await get()).json();
    expect(visitor.needs[0]).toMatchObject({ title: 'Search the greenbelt', details: null, mine: null, onIt: 1, peopleNeeded: 2 });

    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    const member = await (await get()).json();
    expect(member.needs[0]).toMatchObject({ details: 'Meet at the trailhead', mine: 'on' });
  });

  test('an unknown force', async () => {
    prisma.rescueForce.findFirst.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
