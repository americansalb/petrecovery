/**
 * A Rescue Force's needs: what its searches need done, who is on each one,
 * and what members have finished. Behind the Needs tab
 * (app/rescue-forces/[id]/(tabs)/needs) and /api/rescue-forces/[id]/needs,
 * which the phone apps can use too.
 *
 * A member adds a need for one of the force's pets (createNeed; the
 * suggestions come from app/lib/needOptions.js).
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
import { NEED_KINDS, NEED_WHENS, needOptions, needTitle, sameNeed } from '@/app/lib/needOptions';

export const OPEN_NEED_STATUSES = ['AVAILABLE', 'IN_PROGRESS', 'NEEDS_HELP'];
const TAKEN = ['ACTIVE', 'COMPLETED'];

function counts(participants) {
  const onIt = participants.filter((p) => p.status === 'ACTIVE').length;
  const done = participants.filter((p) => p.status === 'COMPLETED').length;
  return { onIt, done, taken: onIt + done };
}

/**
 * Open needs, most urgent first. `member` adds each need's notes; `userId`
 * adds where that person stands on it (`mine`: 'on', 'done' or null);
 * `caseId` keeps one pet's needs (its page lists them).
 */
export async function listNeeds(forceId, { userId = null, member = false, caseId = null } = {}) {
  const rows = await prisma.squadTask.findMany({
    where: { rescueSquadId: forceId, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' }, ...(caseId && { caseId }) },
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

/** The latest finished needs, newest first; the viewer's own read "You". `caseId`: one pet's. */
export async function recentNeedActivity(forceId, { userId = null, take = 10, caseId = null } = {}) {
  const rows = await prisma.squadActivity.findMany({
    where: { rescueSquadId: forceId, type: 'NEED_DONE', ...(caseId && { caseId }) },
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

// A phone number or a house number in a need: people reach the owner from
// the pet's page, and a need's title is public.
const PHONE = /\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}/;
const HOUSE_NUMBER = /\b\d{1,5}\s+[a-z]+(\s[a-z]+)?\s(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|pl|place)\b/i;
const NOTE_MAX = 140;
const TITLE_MAX = 80;

/**
 * Add a need for one of the force's pets, for an active member. `body`:
 * { caseId, kind: area | doors | flyers | shelter | other, placeId?,
 * shelterId?, when: today | tonight | tomorrow | weekend, people: 1-20,
 * title? (for other), note?, anyway? }. The title is written here from the
 * place or shelter, so it never carries a house number. A need the pet
 * already has comes back as NeedError 409 with `duplicate` set, unless
 * `anyway`. Returns { id, title }.
 */
export async function createNeed({ forceId, userId, body }) {
  const kind = NEED_KINDS[body.kind] ? body.kind : null;
  if (!kind) throw new NeedError('Pick what kind of need it is.', 400);
  const when = NEED_WHENS[body.when] ? body.when : 'today';
  const people = Math.round(Number(body.people));
  if (!Number.isFinite(people) || people < 1 || people > 20) throw new NeedError('Ask for 1 to 20 people.', 400);

  const [membership, assignment] = await Promise.all([
    prisma.rescueForceMember.findFirst({ where: { rescueSquadId: forceId, userId, isActive: true }, select: { id: true } }),
    body.caseId
      ? prisma.caseAssignment.findFirst({
          where: { rescueSquadId: forceId, missionId: String(body.caseId) },
          select: {
            case: {
              select: {
                id: true,
                status: true,
                reportType: true,
                petName: true,
                petSpecies: true,
                reporterId: true,
                lastSeenAddress: true,
                lastSeenLatitude: true,
                lastSeenLongitude: true,
              },
            },
          },
        })
      : null,
  ]);
  if (!membership) throw new NeedError('Join this Rescue Force to add a need.', 403);
  const pet = assignment?.case;
  if (!pet) throw new NeedError('That pet is not one this Rescue Force is looking for.', 400);
  if (!isCaseOpen(pet.status)) throw new NeedError('This pet is not missing any more.', 409);

  const open = await prisma.squadTask.findMany({
    where: { rescueSquadId: forceId, caseId: pet.id, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' } },
    select: { id: true, title: true, shelterId: true, peopleNeeded: true, participants: { select: { status: true } } },
  });
  const { places, shelters } = await needOptions(pet, open);
  const place = body.placeId ? places.find((p) => p.id === body.placeId) || null : null;
  const shelter = body.shelterId ? shelters.find((s) => s.id === body.shelterId) || null : null;
  if (body.placeId && !place) throw new NeedError('Pick one of the places on the list.', 400);
  if (kind === 'shelter' && !shelter) throw new NeedError('Pick a shelter from the list.', 400);

  const title = (kind === 'other' ? String(body.title || '').trim().replace(/\s+/g, ' ') : needTitle(kind, { place, shelter })).slice(0, TITLE_MAX);
  if (!title) throw new NeedError(kind === 'other' ? 'Say what needs doing.' : 'Pick where.', 400);
  const note = String(body.note || '').trim();
  if (note.length > NOTE_MAX) throw new NeedError(`Please keep the note under ${NOTE_MAX} letters.`, 400);
  // Only what the person typed: a title written from a place ("near I-35
  // Frontage Rd") is already free of house numbers.
  const typed = `${kind === 'other' ? title : ''} ${note}`;
  if (PHONE.test(typed)) throw new NeedError("Please leave out phone numbers. People reach the owner from the pet's page.", 400);
  if (HOUSE_NUMBER.test(typed)) throw new NeedError('Please leave out house numbers. Name a street or a park instead.', 400);

  if (!body.anyway) {
    const same = sameNeed(open, { kind, title, shelterId: shelter?.id });
    if (same) {
      const taken = same.participants.filter((p) => TAKEN.includes(p.status)).length;
      const error = new NeedError(`${caseTitle(pet)} already has this need: ${same.title}.`, 409);
      error.duplicate = { id: same.id, title: same.title, taken, peopleNeeded: Math.max(1, same.peopleNeeded || 1) };
      throw error;
    }
  }

  const byOwner = pet.reporterId === userId;
  const need = await prisma.squadTask.create({
    data: {
      rescueSquadId: forceId,
      caseId: pet.id,
      title,
      description: [`${NEED_WHENS[when]}.`, note].filter(Boolean).join(' '),
      type: NEED_KINDS[kind].type,
      taskType: NEED_KINDS[kind].taskType,
      priority: byOwner ? 'HIGH' : 'MEDIUM',
      priorityScore: NEED_KINDS[kind].score + (byOwner ? 10 : 0),
      status: 'AVAILABLE',
      role: 'SQUAD',
      peopleNeeded: people,
      ownerRequested: byOwner,
      ownerRequestedAt: byOwner ? new Date() : null,
      address: place?.label || null,
      latitude: place?.lat ?? null,
      longitude: place?.lng ?? null,
      shelterId: shelter?.id || null,
      createdById: userId,
    },
    select: { id: true, title: true },
  });
  return need;
}
