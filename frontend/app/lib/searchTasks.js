/**
 * The tasks of one search that are not searching ground (SearchTask):
 * reading them, setting one up, and keeping it. What each is, and which
 * suit which animal, is app/lib/searchPlan.js.
 *
 * They are set up and kept by whoever runs the search. Where a feeding
 * station or a trap is must not reach everyone with the link: people who
 * mean well go and stand at it, and that is what keeps the animal away.
 * So the route sends them only to the person running the search and to a
 * force looking for the pet.
 */
import prisma from '@/app/lib/prisma';
import { TASK_KINDS, KEPT_KINDS } from '@/app/lib/searchPlan';

const NOTE_CHARS = 280;
const PLACE_CHARS = 120;
/** How many tasks one search can have open: a list longer than this is not being run. */
export const MAX_OPEN_TASKS = 30;
export const TASK_ACTIONS = ['checked', 'done', 'drop'];

const clean = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max) || null;

/** A task as the screen is sent it. No account id leaves the server. */
export function taskForScreen(row) {
  return {
    id: row.id,
    kind: TASK_KINDS.includes(row.kind) ? row.kind : 'OTHER',
    note: row.note || '',
    place: row.place || '',
    status: row.status,
    by: row.createdByName || null,
    createdAt: row.createdAt,
    checkedAt: row.checkedAt || null,
    doneAt: row.doneAt || null,
  };
}

/** The tasks of a search: open ones first, newest first, then what was finished. */
export async function listTasks(caseId) {
  const rows = await prisma.searchTask.findMany({ where: { caseId, status: { in: ['OPEN', 'DONE'] } }, orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], take: 80 });
  return rows.map(taskForScreen);
}

/** Set a task up. Resolves to { task } or { error: 'BAD_KIND' | 'TOO_MANY' }. */
export async function addTask({ caseId, searcher, kind, note = '', place = '' }) {
  if (!TASK_KINDS.includes(kind)) return { error: 'BAD_KIND' };
  const open = await prisma.searchTask.count({ where: { caseId, status: 'OPEN' } });
  if (open >= MAX_OPEN_TASKS) return { error: 'TOO_MANY' };
  const row = await prisma.searchTask.create({
    data: { caseId, kind, note: clean(note, NOTE_CHARS), place: clean(place, PLACE_CHARS), createdById: String(searcher.userId || searcher.id), createdByName: searcher.firstName || null },
  });
  return { task: taskForScreen(row) };
}

/**
 * Keep a task: say it was looked at ('checked', for a station, a camera or
 * a trap), finish it ('done'), or take it off the list ('drop'). Resolves
 * to { task } or { error: 'NOT_FOUND' | 'BAD_ACTION' | 'NOT_KEPT' }.
 */
export async function actOnTask({ caseId, id, action, note = undefined, now = Date.now() }) {
  if (!TASK_ACTIONS.includes(action)) return { error: 'BAD_ACTION' };
  const before = await prisma.searchTask.findFirst({ where: { id: String(id), caseId, status: 'OPEN' } });
  if (!before) return { error: 'NOT_FOUND' };
  if (action === 'checked' && !KEPT_KINDS.includes(before.kind)) return { error: 'NOT_KEPT' };
  const when = new Date(now);
  const data = action === 'checked' ? { checkedAt: when } : action === 'done' ? { status: 'DONE', doneAt: when } : { status: 'DROPPED' };
  const words = note === undefined ? {} : { note: clean(note, NOTE_CHARS) };
  const row = await prisma.searchTask.update({ where: { id: before.id }, data: { ...data, ...words } });
  return { task: taskForScreen(row) };
}
