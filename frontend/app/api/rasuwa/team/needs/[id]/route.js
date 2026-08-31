import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { NEED_ACTIONS, cleanTeamName } from '@/app/rasuwa/team/teamLogic';

/**
 * POST /api/rasuwa/team/needs/[id] { action, name } - move one need
 * through its life: claim ("I'll do it"), release (hand it back),
 * done, reopen.
 *
 * Every transition is a conditional update on the status the action
 * expects (the mission control claim pattern), so two people tapping
 * "I'll do it" at once cannot both hold the need: the second update
 * matches nothing, and the answer is a 409 carrying the need as it
 * now is, for the client to redraw from.
 *
 * Anyone on the board may mark a need done, whoever holds it: at a
 * letter-writing table the person who did the thing and the person at
 * the keyboard are often not the same person. Releasing is the
 * holder's alone.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request, { params }) {
  if (!hasTeamCookie(request)) {
    return NextResponse.json({ error: 'join' }, { status: 401, ...NO_STORE });
  }
  const id = String(params?.id || '');
  let action = '';
  let name = '';
  try {
    const body = await request.json();
    action = String(body.action || '');
    name = cleanTeamName(body.name);
  } catch {
    // validated below
  }
  if (!id || !NEED_ACTIONS.includes(action) || !name) {
    return NextResponse.json(
      { error: 'That change needs the need, an action, and your name.' },
      { status: 400, ...NO_STORE }
    );
  }

  const now = new Date();
  const attempt =
    action === 'claim'
      ? {
          where: { id, status: 'OPEN' },
          data: { status: 'CLAIMED', claimedBy: name, claimedAt: now },
        }
      : action === 'release'
        ? {
            where: { id, status: 'CLAIMED', claimedBy: name },
            data: { status: 'OPEN', claimedBy: '', claimedAt: null },
          }
        : action === 'done'
          ? {
              where: { id, status: { in: ['OPEN', 'CLAIMED'] } },
              data: { status: 'DONE', doneBy: name, doneAt: now },
            }
          : {
              where: { id, status: 'DONE' },
              data: { status: 'OPEN', claimedBy: '', claimedAt: null, doneBy: '', doneAt: null },
            };

  try {
    const { count } = await prisma.rasuwaTeamNeed.updateMany(attempt);
    const need = await prisma.rasuwaTeamNeed.findUnique({ where: { id } });
    if (!need) {
      return NextResponse.json({ error: 'That need is gone.' }, { status: 404, ...NO_STORE });
    }
    if (count === 1) {
      return NextResponse.json({ need }, NO_STORE);
    }
    // Nothing matched: the need moved under this person's feet, or the
    // action repeats what already happened. Repeats are fine (claiming
    // what you already hold, marking done what is done); the rest is a
    // conflict the client redraws from.
    const repeat =
      (action === 'claim' && need.status === 'CLAIMED' && need.claimedBy === name) ||
      (action === 'done' && need.status === 'DONE');
    if (repeat) {
      return NextResponse.json({ need }, NO_STORE);
    }
    return NextResponse.json({ need, conflict: true }, { status: 409, ...NO_STORE });
  } catch {
    return NextResponse.json(
      { error: 'The board could not save that. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
