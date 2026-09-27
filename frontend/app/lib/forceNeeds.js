/**
 * A Rescue Force's needs: what its searches need done, who is on each one,
 * and what members have finished. Behind the Needs tab
 * (app/rescue-forces/[id]/(tabs)/needs) and /api/rescue-forces/[id]/needs,
 * which the phone apps can use too.
 *
 * A need is a SquadTask that is open (not done, not blocked) and not one
 * of the owner's own to-dos (role OWNER). It asks for `peopleNeeded`
 * people. A member takes it (a TaskParticipant, ACTIVE), can drop it
 * again (LEFT), and marks it done (COMPLETED); the need closes when as
 * many people as it asked for have done it. Each finished need leaves a
 * NEED_DONE activity row, which is what "Recent activity" lists.
 */

import prisma from '@/app/lib/prisma';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { caseStatus, caseTitle } from '@/app/lib/caseLabels';

export const OPEN_NEED_STATUSES = ['AVAILABLE', 'IN_PROGRESS', 'NEEDS_HELP'];
const TAKEN = ['ACTIVE', 'COMPLETED'];

function counts(participants) {
  const onIt = participants.filter((p) => p.status === 'ACTIVE').length;
  const done = participants.filter((p) => p.status === 'COMPLETED').length;
  return { onIt, done, taken: onIt + done };
}

/**
 * Open needs, most urgent first. `member` adds each need's notes; `userId`
 * adds where that person stands on it (`mine`: 'on', 'done' or null).
 */
export async function listNeeds(forceId, { userId = null, member = false } = {}) {
  const rows = await prisma.squadTask.findMany({
    where: { rescueSquadId: forceId, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' } },
    orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      caseId: true,
      peopleNeeded: true,
      ownerRequested: true,
      ownerRequestedHelp: true,
      createdAt: true,
      participants: { select: { userId: true, status: true } },
    },
    take: 100,
  });

  const caseIds = [...new Set(rows.map((r) => r.caseId).filter(Boolean))];
  const cases = caseIds.length
    ? await prisma.case.findMany({
        where: { id: { in: caseIds } },
        select: {
          id: true,
          caseNumber: true,
          status: true,
          reportType: true,
          resolution: true,
          petName: true,
          petSpecies: true,
          petPhotoUrl: true,
        },
      })
    : [];
  const caseById = new Map(cases.map((c) => [c.id, c]));

  return rows
    .filter((r) => !r.caseId || isCaseOpen(caseById.get(r.caseId)?.status))
    .map((r) => {
      const c = r.caseId ? caseById.get(r.caseId) : null;
      const mineRow = userId ? r.participants.find((p) => p.userId === userId) : null;
      const mine = mineRow?.status === 'ACTIVE' ? 'on' : mineRow?.status === 'COMPLETED' ? 'done' : null;
      return {
        id: r.id,
        title: r.title,
        details: member ? r.description || null : null,
        askedAt: r.createdAt.toISOString(),
        peopleNeeded: Math.max(1, r.peopleNeeded || 1),
        ...counts(r.participants),
        byOwner: r.ownerRequested || r.ownerRequestedHelp,
        mine,
        pet: c
          ? {
              name: caseTitle(c),
              photo: c.petPhotoUrl || null,
              species: c.petSpecies || null,
              caseNumber: c.caseNumber,
              status: caseStatus(c).key,
            }
          : null,
      };
    });
}

/** The latest finished needs, newest first; the viewer's own read "You". */
export async function recentNeedActivity(forceId, { userId = null, take = 10 } = {}) {
  const rows = await prisma.squadActivity.findMany({
    where: { rescueSquadId: forceId, type: 'NEED_DONE' },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, details: true, actorId: true, createdAt: true, actor: { select: { firstName: true } } },
  });
  return rows.map((a) => {
    const who = userId && a.actorId === userId ? 'You' : (a.actor?.firstName || '').trim() || 'A member';
    return { id: a.id, text: `${who} finished: ${a.details || 'a need'}`, at: a.createdAt.toISOString() };
  });
}

export class NeedError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Take, drop or finish a need, for an active member of its force.
 * Returns `{ mine, closed }` after the change; throws NeedError for a
 * refusal the member should read.
 */
export async function actOnNeed({ forceId, needId, userId, action }) {
  if (!['take', 'drop', 'done'].includes(action)) throw new NeedError('Unknown action.', 400);

  const [membership, need] = await Promise.all([
    prisma.rescueForceMember.findFirst({ where: { rescueSquadId: forceId, userId, isActive: true }, select: { id: true } }),
    prisma.squadTask.findFirst({
      where: { id: needId, rescueSquadId: forceId, role: { not: 'OWNER' } },
      select: {
        id: true,
        title: true,
        status: true,
        caseId: true,
        peopleNeeded: true,
        participants: { select: { userId: true, status: true } },
      },
    }),
  ]);
  if (!membership) throw new NeedError('Join this Rescue Force to help with its needs.', 403);
  if (!need) throw new NeedError('That need was not found.', 404);
  if (!OPEN_NEED_STATUSES.includes(need.status)) throw new NeedError('This need is already done.', 409);

  const wanted = Math.max(1, need.peopleNeeded || 1);
  const mine = need.participants.find((p) => p.userId === userId) || null;
  const others = need.participants.filter((p) => p.userId !== userId);
  const othersTaken = others.filter((p) => TAKEN.includes(p.status)).length;
  const key = { taskId_userId: { taskId: need.id, userId } };
  const now = new Date();

  if (action === 'take') {
    if (mine?.status === 'ACTIVE') return { mine: 'on', closed: false };
    if (mine?.status === 'COMPLETED') throw new NeedError('You already did this one.', 409);
    if (othersTaken >= wanted) throw new NeedError('Enough people are on this one already.', 409);
    await prisma.$transaction([
      prisma.taskParticipant.upsert({
        where: key,
        update: { status: 'ACTIVE', leftAt: null, joinedAt: now },
        create: { taskId: need.id, userId, status: 'ACTIVE', joinedAt: now },
      }),
      prisma.squadTask.update({ where: { id: need.id }, data: { status: 'IN_PROGRESS' } }),
    ]);
    return { mine: 'on', closed: false };
  }

  if (action === 'drop') {
    if (mine?.status !== 'ACTIVE') return { mine: mine?.status === 'COMPLETED' ? 'done' : null, closed: false };
    await prisma.$transaction([
      prisma.taskParticipant.update({ where: key, data: { status: 'LEFT', leftAt: now } }),
      // Nobody else on it or done: it is open for anyone again.
      ...(othersTaken === 0 ? [prisma.squadTask.update({ where: { id: need.id }, data: { status: 'AVAILABLE' } })] : []),
    ]);
    return { mine: null, closed: false };
  }

  // done: take it first if the member had not.
  if (mine?.status === 'COMPLETED') return { mine: 'done', closed: false };
  if (!mine || mine.status !== 'ACTIVE') {
    if (othersTaken >= wanted) throw new NeedError('Enough people are on this one already.', 409);
  }
  const doneCount = others.filter((p) => p.status === 'COMPLETED').length + 1;
  const closed = doneCount >= wanted;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
  const name = (user?.firstName || '').trim() || 'A member';
  await prisma.$transaction([
    prisma.taskParticipant.upsert({
      where: key,
      update: { status: 'COMPLETED', leftAt: null },
      create: { taskId: need.id, userId, status: 'COMPLETED', joinedAt: now },
    }),
    prisma.squadTask.update({
      where: { id: need.id },
      data: closed
        ? { status: 'COMPLETED', completedById: userId, completedAt: now }
        : { status: 'IN_PROGRESS' },
    }),
    prisma.squadActivity.create({
      data: {
        rescueSquadId: forceId,
        type: 'NEED_DONE',
        // The list reads "Mike finished: <details>"; message is the whole sentence for other readers.
        message: `${name} finished: ${need.title}`,
        details: need.title,
        actorId: userId,
        caseId: need.caseId,
      },
    }),
  ]);
  return { mine: 'done', closed };
}
