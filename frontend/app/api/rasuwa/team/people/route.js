import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import missingPeople from '@/app/rasuwa/missing-people.json';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { cleanTeamName, normalizePersonKey, personKeySets } from '@/app/rasuwa/team/teamLogic';

/**
 * POST /api/rasuwa/team/people { personKey, name, action } - a
 * standing "I'll write for them" claim on one person from the list of
 * the missing (action "claim"), or taking that claim back (action
 * "release"). Claims are per (person, name): several people can stand
 * for the same person, and the coverage wall shows all of them.
 * personKey must be a person on the list. Board cookie required.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

// Canonical and earlier printed (`aka`) name keys both resolve to the
// person; claims are stored under the canonical key, and release acts
// on the whole set so a claim made before a rename still lets go.
const PERSON_KEYS = personKeySets(missingPeople.people);

export async function POST(request) {
  if (!hasTeamCookie(request)) {
    return NextResponse.json({ error: 'join' }, { status: 401, ...NO_STORE });
  }
  let personKey = '';
  let name = '';
  let action = '';
  try {
    const body = await request.json();
    personKey = normalizePersonKey(body.personKey);
    name = cleanTeamName(body.name);
    action = String(body.action || '');
  } catch {
    // validated below
  }
  const person = PERSON_KEYS.get(personKey);
  if (!person || !name || !['claim', 'release'].includes(action)) {
    return NextResponse.json(
      { error: 'That claim needs a person from the list, your name, and claim or release.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    if (action === 'claim') {
      await prisma.rasuwaPersonClaim.upsert({
        where: { personKey_claimedBy: { personKey: person.canonical, claimedBy: name } },
        create: { personKey: person.canonical, claimedBy: name },
        update: {},
      });
    } else {
      await prisma.rasuwaPersonClaim.deleteMany({
        where: { personKey: { in: person.keys }, claimedBy: name },
      });
    }
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'The board could not save that. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
