/**
 * Voices (beta): Script rounds heard instead of read.
 *
 * A language can have several ElevenLabs voices (GeoVoice), and a round
 * picks one of the ones that are on, weighted by how often the admin
 * asked for it. The audio comes from ElevenLabs' v3 model, one sentence
 * at a time, and is kept in the database the first time it is made
 * (GeoVoiceClip), so each sentence is paid for once per voice and every
 * later round plays the stored copy. Nobody downloads or uploads a file:
 * the admin finds voices in ElevenLabs' library or their own account on
 * /geo/admin/voices, listens, and switches them on (founder, 2026-09-27:
 * the languages he knows v3 speaks well are the beta, and each language
 * needs more than one voice).
 *
 * What is sent to ElevenLabs is only ever a sentence from the corpus
 * (server/samples.js), never anything a player typed, and a player can
 * only reach a clip through a sealed round token, so the bill is bounded
 * by the size of the corpus times the voices on. GEO_VOICE_DAILY_CHARACTERS
 * caps a day's new audio on top of that, in case something goes wrong.
 *
 * Server only. The API key is ELEVENLABS_API_KEY and never leaves it.
 */

import { createHash } from 'crypto';
import prisma from '@/app/lib/geo/server/db';
import { LANGUAGES, languageByCode } from '@/app/lib/geo/languages';
import { samplesFor } from '@/app/lib/geo/server/samples';

export const VOICE_MODEL = 'eleven_v3';
const API = 'https://api.elevenlabs.io';
/** 64 kbps speech: small, and indistinguishable from more on a phone. */
const OUTPUT_FORMAT = 'mp3_44100_64';
const DEFAULT_DAILY_CHARACTERS = 20000;
export const MAX_VOICES_PER_LANGUAGE = 12;

/** How often a voice is picked, relative to the language's other voices. */
export const VOICE_WEIGHTS = Object.freeze({ 1: 'Less often', 2: 'Normal', 4: 'More often' });

/**
 * v3's stability setting, which ElevenLabs names by what it does:
 * creative is the most expressive and can drift, robust is the steadiest
 * and the least responsive, natural sits between and is the default.
 */
export const DELIVERIES = Object.freeze({ creative: 0, natural: 0.5, robust: 1 });

/**
 * The game's languages ElevenLabs lists for v3 (its models page, checked
 * 2026-09-26), each with the code its Voice Library files the language
 * under (ISO 639-1 where there is one). The admin screen shows these
 * first; the others can still be tried, since the list is theirs to grow.
 */
export const V3_LANGUAGES = Object.freeze({
  afr: 'af', arb: 'ar', hye: 'hy', asm: 'as', azj: 'az', bel: 'be', ben: 'bn', bos: 'bs', bul: 'bg',
  cat: 'ca', ceb: 'ceb', nya: 'ny', hrv: 'hr', ces: 'cs', dan: 'da', nld: 'nl', est: 'et', tgl: 'fil',
  fin: 'fi', fra: 'fr', glg: 'gl', kat: 'ka', deu: 'de', ell: 'el', guj: 'gu', hau: 'ha', heb: 'he',
  hin: 'hi', hun: 'hu', isl: 'is', ind: 'id', gle: 'ga', ita: 'it', jpn: 'ja', jav: 'jv', kan: 'kn',
  kaz: 'kk', kir: 'ky', kor: 'ko', lav: 'lv', lin: 'ln', lit: 'lt', ltz: 'lb', mkd: 'mk', zsm: 'ms',
  mal: 'ml', cmn: 'zh', mar: 'mr', npi: 'ne', nob: 'no', pbu: 'ps', pes: 'fa', pol: 'pl', por: 'pt',
  pan: 'pa', ron: 'ro', rus: 'ru', srp: 'sr', snd: 'sd', slk: 'sk', slv: 'sl', som: 'so', spa: 'es',
  swh: 'sw', swe: 'sv', tam: 'ta', tel: 'te', tha: 'th', tur: 'tr', ukr: 'uk', urd: 'ur', vie: 'vi',
  cym: 'cy',
});

/** ElevenLabs voice ids are short runs of letters and digits. */
export const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const OWNER_ID = /^[A-Za-z0-9]{8,100}$/;

export class VoiceError extends Error {
  /**
   * `detail` is what ElevenLabs said, for the admin screen only: a
   * player is told that the audio did not load, never why.
   */
  constructor(code, message, detail = '') {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

const clean = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const httpsUrl = (value) => (typeof value === 'string' && /^https:\/\/[^\s"'<>]+$/.test(value) ? value.slice(0, 500) : null);

function knownLanguage(code) {
  const language = typeof code === 'string' ? languageByCode(code) : null;
  if (!language) throw new VoiceError('bad_language', 'Name the language by its three-letter code');
  return language;
}

export function dailyCap(env = process.env) {
  const value = Math.floor(Number(env.GEO_VOICE_DAILY_CHARACTERS));
  return value > 0 ? value : DEFAULT_DAILY_CHARACTERS;
}

const startOfDay = (now) => {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  return day;
};

/** Characters sent to ElevenLabs since midnight UTC. */
export async function charactersToday({ store = prisma, now = Date.now() } = {}) {
  const today = await store.geoVoiceClip.aggregate({ _sum: { chars: true }, where: { createdAt: { gte: startOfDay(now) } } });
  return today?._sum?.chars || 0;
}

// ---- What rounds play ------------------------------------------------------

/**
 * The voices a Voices round can use, as { code: [voice] }, for languages
 * that are on and only their voices that are on. Oldest first, so the
 * weighted pick for a seed does not move when an unrelated row changes.
 */
export async function enabledVoices({ store = prisma } = {}) {
  const [languages, voices] = await Promise.all([
    store.geoVoiceLanguage.findMany({ where: { enabled: true }, select: { language: true } }),
    store.geoVoice.findMany({
      where: { enabled: true },
      select: { id: true, language: true, voiceId: true, weight: true, delivery: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const on = new Set(languages.map((row) => row.language));
  const out = {};
  for (const voice of voices) if (on.has(voice.language)) (out[voice.language] ||= []).push(voice);
  return out;
}

// ---- The admin screen ------------------------------------------------------

/** Every Script language with its switch and how many voices and clips it has. */
export async function voiceOverview({ store = prisma, env = process.env, now = Date.now() } = {}) {
  const [languages, voices, clips, usedToday] = await Promise.all([
    store.geoVoiceLanguage.findMany({ select: { language: true, enabled: true } }),
    store.geoVoice.findMany({ select: { language: true, enabled: true } }),
    store.geoVoiceClip.groupBy({ by: ['language'], _count: { _all: true } }),
    charactersToday({ store, now }),
  ]);
  const enabled = new Set(languages.filter((row) => row.enabled).map((row) => row.language));
  const count = {};
  for (const voice of voices) {
    const entry = (count[voice.language] ||= { voices: 0, voicesOn: 0 });
    entry.voices += 1;
    if (voice.enabled) entry.voicesOn += 1;
  }
  const clipCount = Object.fromEntries(clips.map((row) => [row.language, row._count._all]));
  return {
    keySet: Boolean(env.ELEVENLABS_API_KEY),
    cap: dailyCap(env),
    usedToday,
    languages: LANGUAGES.map((language) => ({
      code: language.code,
      name: language.name,
      endonym: language.endonym || '',
      v3: language.code in V3_LANGUAGES,
      enabled: enabled.has(language.code),
      voices: count[language.code]?.voices || 0,
      voicesOn: count[language.code]?.voicesOn || 0,
      clips: clipCount[language.code] || 0,
    })),
  };
}

/**
 * One language in full: its voices, which of its sentences each voice
 * has made in its current delivery, and the open "How it sounds"
 * reports against each voice.
 */
export async function languageVoices(code, { store = prisma } = {}) {
  const language = knownLanguage(code);
  const sentences = samplesFor(language.code);
  const [row, voices, reports] = await Promise.all([
    store.geoVoiceLanguage.findUnique({ where: { language: language.code } }),
    store.geoVoice.findMany({ where: { language: language.code }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    store.geoScriptReport.groupBy({ by: ['voice'], where: { language: language.code, kind: 'voice', status: 'open' }, _count: { _all: true } }),
  ]);
  const keys = voices.map((voice) => sentences.map((text) => clipKey({ language: language.code, voiceId: voice.voiceId, delivery: voice.delivery, text })));
  const all = keys.flat();
  const stored = all.length ? await store.geoVoiceClip.findMany({ where: { key: { in: all } }, select: { key: true } }) : [];
  const have = new Set(stored.map((clip) => clip.key));
  const reported = Object.fromEntries(reports.map((group) => [group.voice, group._count._all]));
  return {
    code: language.code,
    name: language.name,
    endonym: language.endonym || '',
    v3: language.code in V3_LANGUAGES,
    libraryLanguage: V3_LANGUAGES[language.code] || '',
    enabled: Boolean(row?.enabled),
    sentences,
    voices: voices.map((voice, index) => ({
      id: voice.id,
      voiceId: voice.voiceId,
      name: voice.name,
      about: voice.about || '',
      previewUrl: voice.previewUrl || '',
      enabled: voice.enabled,
      weight: voice.weight,
      delivery: voice.delivery,
      made: keys[index].map((key) => have.has(key)),
      reports: reported[voice.id] || 0,
    })),
  };
}

/** Switch a language in or out of Voices rounds. On needs a voice that is on. */
export async function setLanguageEnabled({ language: code, enabled }, { store = prisma } = {}) {
  const language = knownLanguage(code);
  if (enabled) {
    const on = await store.geoVoice.count({ where: { language: language.code, enabled: true } });
    if (!on) throw new VoiceError('no_voice', 'Add a voice and switch it on first');
  }
  return store.geoVoiceLanguage.upsert({
    where: { language: language.code },
    create: { language: language.code, enabled: Boolean(enabled) },
    update: { enabled: Boolean(enabled) },
  });
}

/** A language whose last voice went off cannot stay on: it would have nothing to say. */
async function switchOffIfSilent(language, { store }) {
  const on = await store.geoVoice.count({ where: { language, enabled: true } });
  if (on) return false;
  const result = await store.geoVoiceLanguage.updateMany({ where: { language, enabled: true }, data: { enabled: false } });
  return result.count > 0;
}

export async function addVoice({ language: code, voiceId, name, about, previewUrl }, { store = prisma } = {}) {
  const language = knownLanguage(code);
  const id = clean(voiceId, 60);
  if (!VOICE_ID.test(id)) throw new VoiceError('bad_voice', 'That does not look like an ElevenLabs voice id');
  const existing = await store.geoVoice.findUnique({ where: { language_voiceId: { language: language.code, voiceId: id } } });
  if (existing) throw new VoiceError('duplicate', `That voice is already on ${language.name}`);
  if ((await store.geoVoice.count({ where: { language: language.code } })) >= MAX_VOICES_PER_LANGUAGE) {
    throw new VoiceError('too_many', `${language.name} has ${MAX_VOICES_PER_LANGUAGE} voices, the most it can have. Remove one first.`);
  }
  return store.geoVoice.create({
    data: {
      language: language.code,
      voiceId: id,
      name: clean(name, 80) || id,
      about: clean(about, 120) || null,
      previewUrl: httpsUrl(previewUrl),
    },
  });
}

export async function updateVoice({ id, enabled, weight, delivery }, { store = prisma } = {}) {
  const voice = typeof id === 'string' && id ? await store.geoVoice.findUnique({ where: { id } }) : null;
  if (!voice) throw new VoiceError('no_voice', 'That voice is not on this language any more');
  const data = {};
  if (enabled !== undefined) data.enabled = Boolean(enabled);
  if (weight !== undefined) {
    if (!(String(weight) in VOICE_WEIGHTS)) throw new VoiceError('bad_weight', 'Pick less often, normal or more often');
    data.weight = Number(weight);
  }
  if (delivery !== undefined) {
    if (!Object.hasOwn(DELIVERIES, delivery)) throw new VoiceError('bad_delivery', 'Pick creative, natural or robust');
    data.delivery = delivery;
  }
  const updated = await store.geoVoice.update({ where: { id }, data });
  const languageOff = data.enabled === false ? await switchOffIfSilent(voice.language, { store }) : false;
  return { voice: updated, languageOff };
}

/** Take a voice off a language, with every clip it made for that language. */
export async function removeVoice({ id }, { store = prisma } = {}) {
  const voice = typeof id === 'string' && id ? await store.geoVoice.findUnique({ where: { id } }) : null;
  if (!voice) throw new VoiceError('no_voice', 'That voice is not on this language any more');
  await store.geoVoiceClip.deleteMany({ where: { language: voice.language, voiceId: voice.voiceId } });
  await store.geoVoice.delete({ where: { id } });
  return { languageOff: await switchOffIfSilent(voice.language, { store }) };
}

// ---- ElevenLabs ------------------------------------------------------------

/** What ElevenLabs said when it refused, in its own words. */
async function refusal(response) {
  const raw = await response.text().catch(() => '');
  try {
    const detail = JSON.parse(raw)?.detail;
    if (typeof detail === 'string') return detail.slice(0, 300);
    if (detail?.message) return String(detail.message).slice(0, 300);
    if (detail?.status) return String(detail.status).slice(0, 300);
  } catch {
    // Not JSON; the text is the reason.
  }
  return raw.slice(0, 300);
}

async function elevenLabs(path, { method = 'GET', body, accept = 'application/json', timeoutMs = 15000, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new VoiceError('no_key', 'Voices are not set up on this server: ELEVENLABS_API_KEY is missing');
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      method,
      headers: { 'xi-api-key': apiKey, Accept: accept, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error('[geo/voice] ElevenLabs unreachable', error?.message || error);
    throw new VoiceError('upstream', 'ElevenLabs did not answer');
  }
  if (!response.ok) {
    const detail = await refusal(response);
    console.error('[geo/voice] ElevenLabs', response.status, path.split('?')[0], detail);
    throw new VoiceError('upstream', `ElevenLabs refused (${response.status})`, detail);
  }
  return response;
}

// ElevenLabs writes some labels as identifiers ("middle_aged").
const aboutOf = (...parts) => parts.map((part) => clean(part, 40).replace(/_/g, ' ')).filter(Boolean).join(', ').slice(0, 120);

/**
 * The voices in the ElevenLabs account ("My Voices" and ElevenLabs' own),
 * for the picker. Listing costs nothing.
 */
export async function accountVoices({ search = '', env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const voices = [];
  let pageToken = '';
  // Three pages of a hundred is more than any account here will hold.
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ page_size: '100' });
    if (clean(search, 80)) params.set('search', clean(search, 80));
    if (pageToken) params.set('next_page_token', pageToken);
    const body = await (await elevenLabs(`/v2/voices?${params}`, { env, fetchImpl })).json();
    for (const voice of Array.isArray(body?.voices) ? body.voices : []) {
      if (typeof voice?.voice_id !== 'string' || !VOICE_ID.test(voice.voice_id)) continue;
      const labels = voice.labels || {};
      const verified = Array.isArray(voice.verified_languages) ? voice.verified_languages : [];
      voices.push({
        voiceId: voice.voice_id,
        name: clean(voice.name, 80) || voice.voice_id,
        about: aboutOf(labels.accent, labels.gender, labels.age),
        languages: [...new Set([labels.language, ...verified.map((entry) => entry?.language)].filter((value) => typeof value === 'string' && value))],
        previewUrl: httpsUrl(voice.preview_url) || '',
      });
    }
    if (!body?.has_more || !body?.next_page_token) break;
    pageToken = String(body.next_page_token);
  }
  return voices;
}

/**
 * ElevenLabs' Voice Library: voices other people have shared, searchable
 * by the language they speak. The previews are ElevenLabs' own samples
 * and cost nothing to play.
 */
export async function libraryVoices({ language = '', search = '', gender = '', page = 0, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const params = new URLSearchParams({ page_size: '24', page: String(Math.max(0, Math.min(50, Math.floor(Number(page) || 0)))) });
  if (/^[a-z]{2,3}$/.test(language)) params.set('language', language);
  if (clean(search, 80)) params.set('search', clean(search, 80));
  if (gender === 'female' || gender === 'male') params.set('gender', gender);
  const body = await (await elevenLabs(`/v1/shared-voices?${params}`, { env, fetchImpl })).json();
  const voices = (Array.isArray(body?.voices) ? body.voices : [])
    .filter((voice) => typeof voice?.voice_id === 'string' && VOICE_ID.test(voice.voice_id) && typeof voice?.public_owner_id === 'string' && OWNER_ID.test(voice.public_owner_id))
    .map((voice) => ({
      voiceId: voice.voice_id,
      ownerId: voice.public_owner_id,
      name: clean(voice.name, 80) || voice.voice_id,
      about: aboutOf(voice.accent, voice.gender, voice.age),
      description: clean(voice.description, 200),
      language: clean(voice.language, 12),
      previewUrl: httpsUrl(voice.preview_url) || '',
      uses: Number(voice.cloned_by_count) || 0,
    }));
  return { voices, hasMore: Boolean(body?.has_more) };
}

/**
 * Save a library voice to the account's My Voices, which is what lets
 * the API speak with it. Returns the id to speak with. A voice that is
 * already saved is fine: the id is the same one.
 */
export async function saveLibraryVoice({ ownerId, voiceId, name }, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!OWNER_ID.test(String(ownerId || '')) || !VOICE_ID.test(String(voiceId || ''))) throw new VoiceError('bad_voice', 'That is not a Voice Library voice');
  try {
    const response = await elevenLabs(`/v1/voices/add/${ownerId}/${voiceId}`, {
      method: 'POST',
      body: { new_name: clean(name, 80) || voiceId },
      env,
      fetchImpl,
    });
    const body = await response.json().catch(() => ({}));
    return typeof body?.voice_id === 'string' && VOICE_ID.test(body.voice_id) ? body.voice_id : voiceId;
  } catch (error) {
    if (error instanceof VoiceError && /already/i.test(error.detail)) return voiceId;
    throw error;
  }
}

// ---- Clips -----------------------------------------------------------------

export function clipKey({ language, voiceId, delivery = 'natural', text }) {
  return createHash('sha256').update(`${VOICE_MODEL}|${language}|${voiceId}|${delivery}|${text}`).digest('hex');
}

/**
 * Clips being made right now, by key. The page asks for a sentence ahead
 * of time and the audio player asks again when Play is pressed; if the
 * first request is still with ElevenLabs, the second waits for it
 * instead of paying for the same sentence twice.
 */
const making = new Map();

/**
 * The audio for one sentence in one voice: the stored copy if there is
 * one, otherwise made by ElevenLabs now and stored. Throws VoiceError
 * with `no_key`, `daily_cap` or `upstream` when it cannot.
 */
export async function clipAudio({ language, voiceId, delivery = 'natural', text }, options = {}) {
  const key = clipKey({ language, voiceId, delivery, text });
  if (making.has(key)) return making.get(key);
  const job = makeClip({ key, language, voiceId, delivery, text }, options).finally(() => making.delete(key));
  making.set(key, job);
  return job;
}

async function makeClip({ key, language, voiceId, delivery, text }, { store = prisma, fetchImpl = globalThis.fetch, env = process.env, now = Date.now() } = {}) {
  const stored = await store.geoVoiceClip.findUnique({ where: { key }, select: { audio: true } });
  if (stored) return Buffer.from(stored.audio);

  if (!env.ELEVENLABS_API_KEY) throw new VoiceError('no_key', 'Voices are not set up on this server: ELEVENLABS_API_KEY is missing');
  const chars = [...text].length;
  const cap = dailyCap(env);
  if ((await charactersToday({ store, now })) + chars > cap) {
    throw new VoiceError('daily_cap', `Today's new voice audio has reached its limit of ${cap.toLocaleString('en-US')} characters; stored clips still play`);
  }

  const response = await elevenLabs(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    accept: 'audio/mpeg',
    body: { text, model_id: VOICE_MODEL, voice_settings: { stability: DELIVERIES[delivery] ?? DELIVERIES.natural } },
    timeoutMs: 60000,
    env,
    fetchImpl,
  });
  const audio = Buffer.from(await response.arrayBuffer());
  await store.geoVoiceClip.upsert({
    where: { key },
    create: { key, language, voiceId, model: VOICE_MODEL, text, chars, audio },
    update: {},
  });
  return audio;
}

/** Throw away a stored clip and make it again: v3 reads a sentence differently each time. */
export async function remakeClip(clip, options = {}) {
  const store = options.store || prisma;
  await store.geoVoiceClip.deleteMany({ where: { key: clipKey(clip) } });
  return clipAudio(clip, options);
}

/** A GeoVoice and the sentence it should read, for the admin's clip routes. */
export async function adminClip({ voice: id, n }, { store = prisma } = {}) {
  const voice = typeof id === 'string' && id ? await store.geoVoice.findUnique({ where: { id } }) : null;
  if (!voice) throw new VoiceError('no_voice', 'That voice is not on this language any more');
  const sentences = samplesFor(voice.language);
  const index = Math.floor(Number(n));
  if (!Number.isInteger(index) || index < 0 || index >= sentences.length) throw new VoiceError('no_clip', 'No such sentence');
  return { language: voice.language, voiceId: voice.voiceId, delivery: voice.delivery, text: sentences[index] };
}
