/**
 * "Something wrong?" on the Script answer screen.
 *
 * A player who thinks the map, a hint or the language itself is wrong
 * says so in two taps, and the admin screen counts what comes in. One
 * person disagreeing is an opinion; the same complaint from twenty
 * people about the same language is a bug, and this is how it shows up
 * (founder, 2026-09-25, after asking whether French really belongs on
 * Haiti's map).
 *
 * A report is tied to the round it came from through the round's sealed
 * token. The language and the text are read out of that, never taken
 * from the browser, so nobody can file reports against a language they
 * were never dealt, and the admin sees the exact passage the player saw.
 *
 * Repeats count once: a person who presses Send ten times, or reports
 * the same thing about the same language twice in a day, is one report.
 * That is what the hashed address is for, and all it is for.
 *
 * Server only.
 */

import prisma from '@/app/lib/geo/server/db';
import { languageByCode } from '../languages';
import { scriptRoundFromToken } from './scriptGame';

/** What a player can say is wrong, in the order the answer screen offers them. */
export const REPORT_KINDS = Object.freeze(['area', 'hint', 'language', 'other']);

/** The longest note kept. A report is a pointer, not an essay. */
export const REPORT_NOTE_MAX = 500;

const DAY_MS = 86400000;

export class ReportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * A note as it is stored: control characters out, runs of spaces
 * folded, trimmed, and cut at the limit. Empty is null.
 */
export function cleanNote(value) {
  if (typeof value !== 'string') return null;
  const printable = [...value].filter((ch) => {
    const code = ch.codePointAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  });
  const text = printable
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return null;
  return [...text].slice(0, REPORT_NOTE_MAX).join('');
}

function cleanGuess(guess) {
  const lat = Number(guess?.lat);
  const lng = Number(guess?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { guessLat: null, guessLng: null };
  return { guessLat: Math.round(lat * 1e4) / 1e4, guessLng: Math.round(lng * 1e4) / 1e4 };
}

/**
 * The row a report becomes, or a ReportError. Token errors
 * (GeoTokenError: expired, invalid, no secret) pass through for the
 * route to answer.
 */
export function reportFromRound({ token, kind, note, guess, now = Date.now(), env } = {}) {
  if (typeof token !== 'string' || !token) throw new ReportError('no_round', 'Send the round the report is about');
  if (!REPORT_KINDS.includes(kind)) throw new ReportError('bad_kind', 'Say what is wrong');
  const { language, text } = scriptRoundFromToken({ token, now, env });
  return {
    language: language.code,
    kind,
    note: cleanNote(note),
    text: text || null,
    ...cleanGuess(guess),
  };
}

/**
 * Store a report unless this person already made the same one today and
 * it is still open. A pile marked done is a fix that shipped, so the
 * same complaint after it counts again. Without an address to compare
 * there is nothing to dedupe on, and the rate limit in middleware.js is
 * what keeps that honest.
 */
export async function fileReport(report, { ipHash = null, now = Date.now(), store = prisma } = {}) {
  if (ipHash) {
    const repeat = await store.geoScriptReport.findFirst({
      where: { ipHash, language: report.language, kind: report.kind, status: 'open', createdAt: { gte: new Date(now - DAY_MS) } },
      select: { id: true },
    });
    if (repeat) return { stored: false };
  }
  await store.geoScriptReport.create({ data: { ...report, ipHash } });
  return { stored: true };
}

/**
 * What the admin screen shows: open reports grouped by language and by
 * what was said to be wrong, the biggest pile first, each with its
 * latest few notes so the pile can be read without opening anything.
 */
export async function reportSummary({ store = prisma, notesPerGroup = 3, recent = 500 } = {}) {
  const [groups, latest] = await Promise.all([
    store.geoScriptReport.groupBy({
      by: ['language', 'kind'],
      where: { status: 'open' },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    store.geoScriptReport.findMany({
      where: { status: 'open', NOT: { note: null } },
      orderBy: { createdAt: 'desc' },
      take: recent,
      select: { language: true, kind: true, note: true, text: true, createdAt: true },
    }),
  ]);
  const notes = new Map();
  for (const row of latest) {
    const key = `${row.language}:${row.kind}`;
    const list = notes.get(key) || [];
    if (list.length < notesPerGroup) list.push({ note: row.note, text: row.text, at: row.createdAt });
    notes.set(key, list);
  }
  return groups
    .map((group) => ({
      language: group.language,
      name: languageByCode(group.language)?.name || group.language,
      kind: group.kind,
      count: group._count._all,
      last: group._max.createdAt,
      notes: notes.get(`${group.language}:${group.kind}`) || [],
    }))
    .sort((a, b) => b.count - a.count || new Date(b.last) - new Date(a.last));
}

/** Mark one pile dealt with. New reports about the same thing start a new pile. */
export async function closeReports({ language, kind }, { store = prisma } = {}) {
  if (typeof language !== 'string' || !language || !REPORT_KINDS.includes(kind)) throw new ReportError('bad_group', 'Name the language and the kind');
  const result = await store.geoScriptReport.updateMany({ where: { language, kind, status: 'open' }, data: { status: 'done' } });
  return result?.count || 0;
}
