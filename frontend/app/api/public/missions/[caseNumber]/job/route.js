/**
 * GET /api/public/missions/[caseNumber]/job?way=foot|car|home|gear&when=now30|now60|tonight|party&lat=&lng=
 *
 * One job for the person asking, from what the pet's search needs right
 * now (app/lib/jobs.js): a block of the board nobody is walking, an open
 * need of the force, or the next search party. Signed in only: a block is
 * claimed in their name. Needs and the party are for members of the force
 * looking for the pet; someone who is not a member gets blocks only, and
 * the force to join.
 *
 * Taking the job uses the routes that already own each thing: the board's
 * claim (PATCH /api/mission/[caseId]/grid/cell), the need (POST
 * /api/rescue-forces/[id]/needs/[needId]) and the party's "I am going".
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { pickJob, WAYS, WHENS } from '@/app/lib/jobs';

export const dynamic = 'force-dynamic';

const CASE_ID = /^c[a-z0-9]{24}$/;
const LIVE_ASSIGNMENTS = ['ACCEPTED', 'ACTIVE', 'STANDBY'];

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Sign in to take a job.' }, { status: 401 });

    const { caseNumber } = await params;
    const { searchParams } = new URL(request.url);
    const way = WAYS[searchParams.get('way')] ? searchParams.get('way') : 'foot';
    const when = WHENS[searchParams.get('when')] ? searchParams.get('when') : 'now30';
    const lat = searchParams.get('lat') === null ? NaN : Number(searchParams.get('lat'));
    const lng = searchParams.get('lng') === null ? NaN : Number(searchParams.get('lng'));
    const near = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

    const pet = await prisma.case.findUnique({
      where: CASE_ID.test(String(caseNumber)) ? { id: caseNumber } : { caseNumber: String(caseNumber) },
      select: {
        id: true,
        status: true,
        reportType: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        assignments: {
          where: { status: { in: LIVE_ASSIGNMENTS }, rescueSquad: { is: { isDeleted: false } } },
          orderBy: { acceptedAt: 'asc' },
          select: { rescueSquad: { select: { id: true, name: true } } },
        },
      },
    });
    if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    if (!isCaseOpen(pet.status) || pet.reportType === 'FOUND') {
      return NextResponse.json({ error: 'This search is not open.', code: 'NOT_OPEN' }, { status: 409 });
    }

    const forces = pet.assignments.map((a) => a.rescueSquad).filter(Boolean);
    const memberships = forces.length
      ? await prisma.rescueForceMember.findMany({
          where: { userId, isActive: true, rescueSquadId: { in: forces.map((f) => f.id) } },
          select: { rescueSquadId: true },
        })
      : [];
    const mine = new Set(memberships.map((m) => m.rescueSquadId));
    const force = forces.find((f) => mine.has(f.id)) || forces[0] || null;
    const member = Boolean(force && mine.has(force.id));

    const picked = await pickJob({ pet, forceId: force?.id || null, userId, member, way, when, near });
    return NextResponse.json({
      ...picked,
      caseId: pet.id,
      force: force ? { id: force.id, name: force.name } : null,
      member,
    });
  } catch (error) {
    console.error('Job pick failed:', error);
    return NextResponse.json({ error: 'Could not find a job right now. Try again in a moment.' }, { status: 500 });
  }
}
