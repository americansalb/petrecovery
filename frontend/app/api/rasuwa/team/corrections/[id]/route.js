import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { CORRECTION_ACTIONS } from '@/app/rasuwa/corrections';
import { cleanTeamName } from '@/app/rasuwa/team/teamLogic';

/**
 * POST /api/rasuwa/team/corrections/[id] { action, name } - mark a
 * public correction request handled (the letter document was fixed,
 * or no change was needed), or reopen one. Board cookie required.
 *
 * Same conditional-update pattern as the needs: the transition only
 * applies from the status it expects, and a miss answers 409 with the
 * row as it now is, for the client to redraw from.
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
  if (!id || !CORRECTION_ACTIONS.includes(action) || !name) {
    return NextResponse.json(
      { error: 'That change needs the request, an action, and your name.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    const attempt =
      action === 'done'
        ? await prisma.rasuwaCorrection.updateMany({
            where: { id, status: 'OPEN' },
            data: { status: 'DONE', handledBy: name },
          })
        : await prisma.rasuwaCorrection.updateMany({
            where: { id, status: 'DONE' },
            data: { status: 'OPEN', handledBy: '' },
          });
    const correction = await prisma.rasuwaCorrection.findUnique({ where: { id } });
    if (!correction) {
      return NextResponse.json({ error: 'That request is gone.' }, { status: 404, ...NO_STORE });
    }
    return NextResponse.json({ correction }, attempt.count === 0 ? { status: 409, ...NO_STORE } : NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'The board could not save that. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
