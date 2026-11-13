/**
 * /api/mission/[missionId]/plan
 *
 * The plan of one pet's search, and its tasks other than searching ground.
 *
 *   GET    { plan, kinds, tasks }. The plan (which tactics suit this
 *          animal, app/lib/searchPlan.js) and the tasks set up so far.
 *   POST   { kind, note, place } sets a task up.
 *   PATCH  { id, action: 'checked' | 'done' | 'drop', note } keeps one.
 *
 * Reading is for whoever runs the search and for a force looking for the
 * pet (the people who see names, app/lib/searcher.js): where a feeding
 * station or a trap is does not go to everyone with the link. Writing is
 * for whoever runs the search. A role in a Rescue Force does not redirect
 * someone else's search.
 */
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { searcherFor } from '@/app/lib/searcher';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { temperamentOf } from '@/app/lib/brief';
import { planFor, taskOf, gearFor, TASK_KINDS } from '@/app/lib/searchPlan';
import { readKit } from '@/app/lib/searchKit';
import { listTasks, addTask, actOnTask } from '@/app/lib/searchTasks';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const READ_LIMIT = { windowMs: 60 * 1000, maxRequests: 60, blockDurationMs: 60 * 1000 };
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
const CASE_SELECT = { id: true, status: true, petName: true, petSpecies: true, details: true, reportType: true };
const WORDS = {
  BAD_KIND: 'Pick one of the tasks on the list.',
  TOO_MANY: 'This search has 30 tasks open. Finish or remove one before adding another.',
  NOT_FOUND: 'That task is no longer on the list.',
  BAD_ACTION: 'That is not something a task can do.',
  NOT_KEPT: 'Only a feeding station, a camera or a trap is checked again.',
};

async function who(request, params) {
  const { missionId } = await params;
  const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: CASE_SELECT }).catch(() => null);
  if (!pet) return { refuse: NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 }) };
  const searcher = await searcherFor(request, pet.id);
  return { pet, searcher };
}

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, READ_LIMIT, 'plan:read');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const { pet, searcher, refuse } = await who(request, params);
    if (refuse) return refuse;
    if (!searcher || !searcher.seesNames) return NextResponse.json({ error: 'The tasks of a search are for the people running it.', code: 'NOT_ALLOWED' }, { status: 403 });
    const name = pet.petName || 'the pet';
    const plan = planFor({ species: pet.petSpecies, temperament: temperamentOf(pet), name });
    // Each task comes with what the site already made for this pet: its flyers, its share pictures, the shelters to call.
    const kit = await readKit(pet.id);
    return NextResponse.json({ plan, kinds: plan.order.map((kind) => ({ ...taskOf(kind, name), gear: gearFor(kind, kit) })), tasks: await listTasks(pet.id), leads: Boolean(searcher.leads) });
  } catch (error) {
    console.error('Plan read failed:', error?.message);
    return NextResponse.json({ error: 'That did not load. Try again in a moment.' }, { status: 500 });
  }
}

async function write(request, params, work) {
  const limit = await withRateLimitAsync(request, WRITE_LIMIT, 'plan:write');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const { pet, searcher, refuse } = await who(request, params);
    if (refuse) return refuse;
    if (!searcher) return NextResponse.json({ error: 'Join the search first.', code: 'NOT_JOINED' }, { status: 401 });
    if (!searcher.leads) return NextResponse.json({ error: 'Only the person running this search sets up its tasks.', code: 'NOT_ALLOWED' }, { status: 403 });
    if (!isCaseOpen(pet.status)) return NextResponse.json({ error: 'This search has ended.', code: 'CLOSED' }, { status: 409 });
    const body = await request.json().catch(() => ({}));
    const result = await work({ pet, searcher, body: body && typeof body === 'object' ? body : {} });
    if (result.error) return NextResponse.json({ error: WORDS[result.error] || 'That did not go through.', code: result.error }, { status: result.error === 'NOT_FOUND' ? 404 : 400 });
    return NextResponse.json({ success: true, task: result.task });
  } catch (error) {
    console.error('Plan write failed:', error?.message);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  return write(request, params, ({ pet, searcher, body }) =>
    addTask({ caseId: pet.id, searcher, kind: TASK_KINDS.includes(body.kind) ? body.kind : '', note: typeof body.note === 'string' ? body.note : '', place: typeof body.place === 'string' ? body.place : '' })
  );
}

export async function PATCH(request, { params }) {
  return write(request, params, ({ pet, body }) =>
    actOnTask({ caseId: pet.id, id: typeof body.id === 'string' ? body.id.slice(0, 40) : '', action: body.action, note: typeof body.note === 'string' ? body.note : undefined })
  );
}
