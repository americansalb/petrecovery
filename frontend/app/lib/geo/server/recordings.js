/**
 * Voices (beta): recordings from the public, on /geo/record.
 *
 * Anyone with a game account (an email address, confirmed by a code;
 * server/accounts.js) can read a language's sentences aloud, once they
 * have agreed to the recording terms and an admin has opened that
 * language for recording. The sentences are the Script corpus
 * (server/samples.js), so a recording plugs straight into a Voices
 * round: the text is known, the reveal shows it, and the clip route
 * plays the person instead of ElevenLabs.
 *
 * Every take waits for an admin (/geo/admin/recordings). When every
 * sentence of a language is approved for one person, the admin adds
 * that person as a voice (GeoVoice, kind "recorded"), with the same
 * on/off and weight as an ElevenLabs voice. If the corpus later grows,
 * the voice sits out of rounds until the new sentences are recorded and
 * approved (server/voice.js, enabledVoices), and the studio shows them
 * as the ones left to read.
 *
 * Only languages an admin opened are ever named on the public page, so
 * it does not give away what the game covers (app/lib/geo/script.js).
 *
 * Server only.
 */

import prisma from '@/app/lib/geo/server/db';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { isSuspended } from '@/app/lib/geo/server/roles';
import { LANGUAGES, languageByCode } from '@/app/lib/geo/languages';
import { samplesFor } from '@/app/lib/geo/server/samples';

/** The terms a contributor agreed to. A new wording is a new version. */
export const CONSENT_VERSION = '2026-09-27';

/** Longest take kept, and the largest file accepted for one. */
export const MAX_TAKE_MS = 30000;
export const MAX_TAKE_BYTES = 1500000;
const MIN_TAKE_MS = 400;
/** Takes one person can send in a day: generous for reading, tight for a script. */
export const TAKES_PER_DAY = 400;

const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac']);

/** Why a take was sent back, as the contributor reads it. */
export const REJECT_REASONS = Object.freeze({
  noise: 'Background noise',
  text: 'Did not match the sentence',
  unclear: 'Hard to make out',
  volume: 'Too quiet or too loud',
  cut: 'Cut off at the start or end',
  other: 'Something else',
});

export class RecordingError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const clean = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const baseType = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();

function knownLanguage(code) {
  const language = typeof code === 'string' ? languageByCode(code) : null;
  if (!language) throw new RecordingError('bad_language', 'Pick a language from the list');
  return language;
}

function sentenceAt(language, n) {
  const sentences = samplesFor(language.code);
  const index = Math.floor(Number(n));
  if (!Number.isInteger(index) || index < 0 || index >= sentences.length) throw new RecordingError('bad_sentence', 'No such sentence');
  return { index, text: sentences[index] };
}

// The script id picks the font the sentence is drawn in (app/geo/script/fonts.js).
const languageCard = (language) => ({
  code: language.code,
  name: language.name,
  endonym: language.endonym || '',
  script: language.script,
});

// ---- The public page -------------------------------------------------------

/** The game account behind a request, if it exists and may record. */
export async function recorderFrom(request, { store = prisma } = {}) {
  const { accountId } = accountFromRequest(request);
  if (!accountId) return null;
  const account = await store.geoAccount.findUnique({ where: { id: accountId }, select: { id: true, email: true, suspendedAt: true } });
  if (!account || isSuspended(account)) return null;
  return { accountId: account.id, email: account.email };
}

/** The languages open for recording, each with how many people have started it. */
export async function openLanguages({ store = prisma } = {}) {
  const rows = await store.geoVoiceLanguage.findMany({ where: { recording: true }, select: { language: true } });
  const codes = rows.map((row) => row.language).filter((code) => languageByCode(code) && samplesFor(code).length);
  if (!codes.length) return [];
  const sets = await store.geoVoiceSet.groupBy({ by: ['language'], where: { language: { in: codes } }, _count: { _all: true } });
  const speakers = Object.fromEntries(sets.map((row) => [row.language, row._count._all]));
  return codes
    .map((code) => ({ ...languageCard(languageByCode(code)), sentences: samplesFor(code).length, speakers: speakers[code] || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function isOpen(code, { store }) {
  const row = await store.geoVoiceLanguage.findUnique({ where: { language: code }, select: { recording: true } });
  return Boolean(row?.recording);
}

/** How far each of a person's languages has got, counted against today's sentences. */
function progressOf(language, recordings) {
  const sentences = samplesFor(language);
  const byText = new Map(recordings.map((row) => [row.text, row]));
  const counts = { total: sentences.length, recorded: 0, approved: 0, pending: 0, rejected: 0, flagged: 0 };
  for (const text of sentences) {
    const row = byText.get(text);
    if (!row) continue;
    counts[row.status] = (counts[row.status] || 0) + 1;
    if (row.status !== 'flagged') counts.recorded += 1;
  }
  counts.left = counts.total - counts.recorded - counts.flagged + counts.rejected;
  return counts;
}

/** Everything the page needs about the signed-in person. */
export async function contributorState(accountId, { store = prisma } = {}) {
  const [contributor, sets, recordings, voices] = await Promise.all([
    store.geoVoiceContributor.findUnique({ where: { accountId } }),
    store.geoVoiceSet.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } }),
    store.geoVoiceRecording.findMany({ where: { accountId }, select: { language: true, text: true, status: true } }),
    store.geoVoice.findMany({ where: { kind: 'recorded', voiceId: accountId }, select: { language: true, enabled: true } }),
  ]);
  const inGame = new Map(voices.map((voice) => [voice.language, voice.enabled]));
  return {
    contributor: contributor
      ? { name: contributor.name, agreed: contributor.consentVersion === CONSENT_VERSION }
      : null,
    sets: sets
      .filter((set) => languageByCode(set.language))
      .map((set) => ({
        ...languageCard(languageByCode(set.language)),
        region: set.region,
        progress: progressOf(set.language, recordings.filter((row) => row.language === set.language)),
        inGame: inGame.get(set.language) === true,
      })),
  };
}

/** Agree to the terms, and say how to be credited. */
export async function joinRecording({ accountId, name, agree }, { store = prisma, now = new Date() } = {}) {
  const shown = clean(name, 60);
  if (!shown) throw new RecordingError('no_name', 'Say how you would like to be credited');
  if (agree !== true) throw new RecordingError('no_consent', 'Agree to the terms to record');
  return store.geoVoiceContributor.upsert({
    where: { accountId },
    create: { accountId, name: shown, consentAt: now, consentVersion: CONSENT_VERSION },
    update: { name: shown, consentAt: now, consentVersion: CONSENT_VERSION },
  });
}

async function requireContributor(accountId, { store }) {
  const contributor = await store.geoVoiceContributor.findUnique({ where: { accountId } });
  if (!contributor || contributor.consentVersion !== CONSENT_VERSION) throw new RecordingError('no_consent', 'Agree to the recording terms first', 403);
  return contributor;
}

/** Start (or rename the region of) a language. */
export async function startSet({ accountId, language: code, region }, { store = prisma } = {}) {
  await requireContributor(accountId, { store });
  const language = knownLanguage(code);
  if (!(await isOpen(language.code, { store }))) throw new RecordingError('closed', 'That language is not open for recording');
  const where = clean(region, 80);
  if (!where) throw new RecordingError('no_region', 'Say where you learned to speak it');
  return store.geoVoiceSet.upsert({
    where: { accountId_language: { accountId, language: language.code } },
    create: { accountId, language: language.code, region: where },
    update: { region: where },
  });
}

async function requireSet(accountId, code, { store }) {
  const set = await store.geoVoiceSet.findUnique({ where: { accountId_language: { accountId, language: code } } });
  if (!set) throw new RecordingError('no_set', 'Start this language first', 404);
  return set;
}

/** The studio: every sentence of the language and where each one stands. */
export async function setDetail({ accountId, language: code }, { store = prisma } = {}) {
  await requireContributor(accountId, { store });
  const language = knownLanguage(code);
  const set = await requireSet(accountId, language.code, { store });
  const open = await isOpen(language.code, { store });
  const rows = await store.geoVoiceRecording.findMany({
    where: { setId: set.id },
    select: { id: true, text: true, status: true, reason: true, durationMs: true },
  });
  const byText = new Map(rows.map((row) => [row.text, row]));
  const sentences = samplesFor(language.code).map((text, n) => {
    const row = byText.get(text);
    return {
      n,
      text,
      id: row?.id || null,
      status: row?.status || 'new',
      reason: row?.status === 'rejected' ? REJECT_REASONS[row.reason] || row.reason || '' : row?.status === 'flagged' ? row.reason || '' : '',
      durationMs: row?.durationMs || null,
    };
  });
  return { language: { ...languageCard(language), region: set.region, open }, sentences };
}

async function takesToday(accountId, { store, now }) {
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  return store.geoVoiceRecording.count({ where: { accountId, updatedAt: { gte: since } } });
}

/** Keep a take. A second take of the same sentence replaces the first. */
export async function saveTake({ accountId, language: code, n, audio, mime, durationMs }, { store = prisma, now = Date.now() } = {}) {
  await requireContributor(accountId, { store });
  const language = knownLanguage(code);
  if (!(await isOpen(language.code, { store }))) throw new RecordingError('closed', 'That language is closed for recording');
  const set = await requireSet(accountId, language.code, { store });
  const { text } = sentenceAt(language, n);
  const type = baseType(mime);
  if (!AUDIO_TYPES.has(type)) throw new RecordingError('bad_audio', 'That is not a recording this page can keep');
  if (!audio?.length) throw new RecordingError('empty', 'The recording was empty');
  if (audio.length > MAX_TAKE_BYTES) throw new RecordingError('too_big', 'That recording is too long', 413);
  const ms = Math.round(Number(durationMs));
  if (!Number.isFinite(ms) || ms < MIN_TAKE_MS) throw new RecordingError('too_short', 'That was too short to hear anything');
  if (ms > MAX_TAKE_MS + 2000) throw new RecordingError('too_long', 'Keep each sentence under 30 seconds');
  if ((await takesToday(accountId, { store, now })) >= TAKES_PER_DAY) throw new RecordingError('daily_cap', 'That is a lot for one day. The rest can wait until tomorrow.', 429);
  const data = { audio, mime: type, durationMs: ms, status: 'pending', reason: null, reviewedAt: null };
  const row = await store.geoVoiceRecording.upsert({
    where: { setId_text: { setId: set.id, text } },
    create: { setId: set.id, accountId, language: language.code, text, ...data },
    update: data,
    select: { id: true, status: true },
  });
  return row;
}

/** Say a sentence is wrong instead of reading it. */
export async function flagSentence({ accountId, language: code, n, note }, { store = prisma } = {}) {
  await requireContributor(accountId, { store });
  const language = knownLanguage(code);
  const set = await requireSet(accountId, language.code, { store });
  const { text } = sentenceAt(language, n);
  const why = clean(note, 300);
  if (!why) throw new RecordingError('no_note', 'Say what is wrong with it');
  const data = { audio: null, mime: null, durationMs: null, status: 'flagged', reason: why, reviewedAt: null };
  return store.geoVoiceRecording.upsert({
    where: { setId_text: { setId: set.id, text } },
    create: { setId: set.id, accountId, language: language.code, text, ...data },
    update: data,
    select: { id: true, status: true },
  });
}

/** A person's own take, to play back. */
export async function ownTake({ accountId, id }, { store = prisma } = {}) {
  const row = typeof id === 'string' && id ? await store.geoVoiceRecording.findUnique({ where: { id } }) : null;
  if (!row || row.accountId !== accountId || !row.audio) throw new RecordingError('not_found', 'No such recording', 404);
  return { audio: Buffer.from(row.audio), mime: row.mime || 'audio/webm' };
}

/**
 * Delete a person's recordings: one language, or all of them. A voice
 * made from them leaves the game with them.
 */
export async function deleteRecordings({ accountId, language }, { store = prisma } = {}) {
  const only = language ? { language: knownLanguage(language).code } : {};
  const removed = await store.geoVoiceRecording.deleteMany({ where: { accountId, ...only } });
  await store.geoVoiceSet.deleteMany({ where: { accountId, ...only } });
  await store.geoVoice.deleteMany({ where: { kind: 'recorded', voiceId: accountId, ...only } });
  if (!language) await store.geoVoiceContributor.deleteMany({ where: { accountId } });
  return { removed: removed.count };
}

// ---- The admin screen ------------------------------------------------------

const REVIEW_FIELDS = { id: true, setId: true, accountId: true, language: true, text: true, mime: true, durationMs: true, status: true, reason: true, createdAt: true, updatedAt: true };

async function people(accountIds, { store }) {
  const ids = [...new Set(accountIds)];
  if (!ids.length) return {};
  const [contributors, accounts, sets] = await Promise.all([
    store.geoVoiceContributor.findMany({ where: { accountId: { in: ids } }, select: { accountId: true, name: true } }),
    store.geoAccount.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } }),
    store.geoVoiceSet.findMany({ where: { accountId: { in: ids } }, select: { id: true, region: true } }),
  ]);
  const names = Object.fromEntries(contributors.map((row) => [row.accountId, row.name]));
  const emails = Object.fromEntries(accounts.map((row) => [row.id, row.email]));
  return { names, emails, regions: Object.fromEntries(sets.map((row) => [row.id, row.region])) };
}

/** Everything waiting for a decision, oldest first, and the sentences people flagged. */
export async function reviewQueue({ language = '', limit = 60 } = {}, { store = prisma } = {}) {
  const where = { status: 'pending', ...(language ? { language } : {}) };
  const [rows, waiting, flags] = await Promise.all([
    store.geoVoiceRecording.findMany({ where, select: REVIEW_FIELDS, orderBy: { updatedAt: 'asc' }, take: Math.min(200, limit) }),
    store.geoVoiceRecording.count({ where }),
    store.geoVoiceRecording.findMany({
      where: { status: 'flagged', ...(language ? { language } : {}) },
      select: REVIEW_FIELDS,
      orderBy: { updatedAt: 'asc' },
      take: 100,
    }),
  ]);
  const who = await people([...rows, ...flags].map((row) => row.accountId), { store });
  const shape = (row) => {
    const language = languageByCode(row.language);
    return {
      id: row.id,
      setId: row.setId,
      language: language ? languageCard(language) : { code: row.language, name: row.language },
      text: row.text,
      durationMs: row.durationMs,
      note: row.status === 'flagged' ? row.reason : '',
      speaker: { name: who.names?.[row.accountId] || 'Someone', email: who.emails?.[row.accountId] || '', region: who.regions?.[row.setId] || '' },
      at: row.updatedAt,
    };
  };
  return { waiting, items: rows.map(shape), flags: flags.map(shape) };
}

/** Every person's languages, with their progress and whether they are in the game. */
export async function speakerSets({ language = '' } = {}, { store = prisma } = {}) {
  const sets = await store.geoVoiceSet.findMany({ where: language ? { language } : {}, orderBy: { updatedAt: 'desc' }, take: 500 });
  if (!sets.length) return [];
  const [recordings, voices, who] = await Promise.all([
    store.geoVoiceRecording.findMany({ where: { setId: { in: sets.map((set) => set.id) } }, select: { setId: true, text: true, status: true } }),
    store.geoVoice.findMany({ where: { kind: 'recorded', voiceId: { in: sets.map((set) => set.accountId) } }, select: { id: true, language: true, voiceId: true, enabled: true } }),
    people(sets.map((set) => set.accountId), { store }),
  ]);
  return sets
    .filter((set) => languageByCode(set.language))
    .map((set) => {
      const progress = progressOf(set.language, recordings.filter((row) => row.setId === set.id));
      const voice = voices.find((row) => row.voiceId === set.accountId && row.language === set.language);
      return {
        id: set.id,
        language: languageCard(languageByCode(set.language)),
        speaker: { name: who.names?.[set.accountId] || 'Someone', email: who.emails?.[set.accountId] || '', region: set.region },
        progress,
        complete: progress.approved === progress.total,
        voice: voice ? { id: voice.id, enabled: voice.enabled } : null,
        updatedAt: set.updatedAt,
      };
    });
}

/** Every Script language, with whether it is open and what has come in for it. */
export async function recordingLanguages({ store = prisma } = {}) {
  const [rows, counts, sets] = await Promise.all([
    store.geoVoiceLanguage.findMany({ select: { language: true, recording: true } }),
    store.geoVoiceRecording.groupBy({ by: ['language', 'status'], _count: { _all: true } }),
    store.geoVoiceSet.groupBy({ by: ['language'], _count: { _all: true } }),
  ]);
  const open = new Set(rows.filter((row) => row.recording).map((row) => row.language));
  const tally = {};
  for (const row of counts) (tally[row.language] ||= {})[row.status] = row._count._all;
  const speakers = Object.fromEntries(sets.map((row) => [row.language, row._count._all]));
  return LANGUAGES.map((language) => ({
    ...languageCard(language),
    open: open.has(language.code),
    sentences: samplesFor(language.code).length,
    speakers: speakers[language.code] || 0,
    pending: tally[language.code]?.pending || 0,
    approved: tally[language.code]?.approved || 0,
  }));
}

export async function setRecordingOpen({ language: code, open }, { store = prisma } = {}) {
  const language = knownLanguage(code);
  if (open && !samplesFor(language.code).length) throw new RecordingError('no_sentences', `${language.name} has no sentences to read`);
  return store.geoVoiceLanguage.upsert({
    where: { language: language.code },
    create: { language: language.code, recording: Boolean(open) },
    update: { recording: Boolean(open) },
  });
}

/** Approve or send back one take. */
export async function reviewTake({ id, decision, reason }, { store = prisma, now = new Date() } = {}) {
  const row = typeof id === 'string' && id ? await store.geoVoiceRecording.findUnique({ where: { id }, select: { id: true, status: true } }) : null;
  if (!row) throw new RecordingError('not_found', 'That recording is gone', 404);
  // "It is fine": the flag goes, and the sentence is back on the
  // speaker's list to read. (A sentence that really is wrong is fixed in
  // the corpus instead; the new text is new to everyone.)
  if (decision === 'dismiss') {
    if (row.status !== 'flagged') throw new RecordingError('bad_decision', 'Only a flagged sentence can be dismissed');
    await store.geoVoiceRecording.delete({ where: { id } });
    return { id, status: 'new' };
  }
  if (row.status === 'flagged') throw new RecordingError('bad_decision', 'A flagged sentence has no recording to approve');
  // Undo on the review screen: back to waiting.
  if (decision === 'reopen') return store.geoVoiceRecording.update({ where: { id }, data: { status: 'pending', reason: null, reviewedAt: null }, select: { id: true, status: true } });
  if (decision === 'approve') return store.geoVoiceRecording.update({ where: { id }, data: { status: 'approved', reason: null, reviewedAt: now }, select: { id: true, status: true } });
  if (decision === 'reject') {
    if (!Object.hasOwn(REJECT_REASONS, reason)) throw new RecordingError('bad_reason', 'Pick why it goes back');
    return store.geoVoiceRecording.update({ where: { id }, data: { status: 'rejected', reason, reviewedAt: now }, select: { id: true, status: true } });
  }
  throw new RecordingError('bad_decision', 'Approve, reject or reopen');
}

/** Approve every take still waiting in one person's language. */
export async function approveSet({ setId }, { store = prisma, now = new Date() } = {}) {
  const result = await store.geoVoiceRecording.updateMany({ where: { setId, status: 'pending' }, data: { status: 'approved', reason: null, reviewedAt: now } });
  return { approved: result.count };
}

/** Put a fully approved set into Voices games, as a voice that is on. */
export async function addSetAsVoice({ setId }, { store = prisma } = {}) {
  const set = typeof setId === 'string' && setId ? await store.geoVoiceSet.findUnique({ where: { id: setId } }) : null;
  if (!set) throw new RecordingError('not_found', 'That set is gone', 404);
  const recordings = await store.geoVoiceRecording.findMany({ where: { setId: set.id }, select: { text: true, status: true } });
  const progress = progressOf(set.language, recordings);
  if (progress.approved !== progress.total) throw new RecordingError('incomplete', `${progress.approved} of ${progress.total} sentences are approved; every one has to be`);
  const existing = await store.geoVoice.findUnique({ where: { language_voiceId: { language: set.language, voiceId: set.accountId } } });
  if (existing) return existing;
  const contributor = await store.geoVoiceContributor.findUnique({ where: { accountId: set.accountId } });
  return store.geoVoice.create({
    data: { language: set.language, kind: 'recorded', voiceId: set.accountId, name: contributor?.name || 'A speaker', about: `Recorded, from ${set.region}`.slice(0, 120), enabled: true },
  });
}

/** Any take, for the admin to hear. */
export async function takeAudio(id, { store = prisma } = {}) {
  const row = typeof id === 'string' && id ? await store.geoVoiceRecording.findUnique({ where: { id }, select: { audio: true, mime: true } }) : null;
  if (!row?.audio) throw new RecordingError('not_found', 'No such recording', 404);
  return { audio: Buffer.from(row.audio), mime: row.mime || 'audio/webm' };
}

// ---- Rounds ----------------------------------------------------------------

/**
 * Which recorded voices can read a round now: every current sentence of
 * the language approved. Takes the recorded GeoVoice rows, returns their
 * ids. One query for all of them.
 */
export async function completeRecordedVoices(voices, { store = prisma } = {}) {
  const recorded = voices.filter((voice) => voice.kind === 'recorded');
  if (!recorded.length) return new Set();
  const rows = await store.geoVoiceRecording.findMany({
    where: { status: 'approved', OR: recorded.map((voice) => ({ language: voice.language, accountId: voice.voiceId })) },
    select: { language: true, accountId: true, text: true },
  });
  const complete = new Set();
  for (const voice of recorded) {
    const have = new Set(rows.filter((row) => row.language === voice.language && row.accountId === voice.voiceId).map((row) => row.text));
    if (samplesFor(voice.language).every((text) => have.has(text))) complete.add(voice.id);
  }
  return complete;
}

/** The approved take of one sentence by one person, for a round. */
export async function recordedClip({ language, accountId, text }, { store = prisma } = {}) {
  const row = await store.geoVoiceRecording.findFirst({ where: { language, accountId, text, status: 'approved' }, select: { audio: true, mime: true } });
  if (!row?.audio) return null;
  return { audio: Buffer.from(row.audio), mime: row.mime || 'audio/webm' };
}
