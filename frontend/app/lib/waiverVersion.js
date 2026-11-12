/**
 * The version of the liability waiver in force, and whether an acceptance
 * on record is of it. The text is prisma/legal/liability-waiver.js, the
 * file boot syncs into the database, so the version here is the version
 * of the text people are shown.
 *
 * An acceptance counts only when it is of the text as it reads today: a
 * new version asks everyone again, at the next thing that takes them out
 * searching. (Until 2026-11-12 any acceptance counted for ever, and the
 * record of it said "1.0" whatever text was shown.)
 */
import { LIABILITY_WAIVER_DOC } from '@/prisma/legal/liability-waiver';

export const WAIVER_VERSION = LIABILITY_WAIVER_DOC.version;

export const waiverIsCurrent = (acceptedAt, version) => Boolean(acceptedAt) && String(version || '') === WAIVER_VERSION;
