/**
 * Voices (beta): Script rounds heard instead of read.
 *
 * The audio comes from ElevenLabs' v3 model, one sentence at a time,
 * and is kept in the database the first time it is made (GeoVoiceClip),
 * so each sentence is paid for once and every later round plays the
 * stored copy. Nobody downloads or uploads a file: an admin pastes a
 * voice id for a language on /geo/admin, listens to a sample, and
 * switches the language on (founder, 2026-09-27: the languages he knows
 * v3 speaks well are the beta).
 *
 * What is sent to ElevenLabs is only ever a sentence from the corpus
 * (server/samples.js), never anything a player typed, and a player can
 * only reach a clip through a sealed round token, so the bill is
 * bounded by the size of the corpus. GEO_VOICE_DAILY_CHARACTERS caps a
 * day's new audio on top of that, in case something goes wrong.
 *
 * Server only. The API key is ELEVENLABS_API_KEY and never leaves it.
 */

import { createHash } from 'crypto';
import prisma from '@/app/lib/geo/server/db';

export const VOICE_MODEL = 'eleven_v3';
const API = 'https://api.elevenlabs.io/v1';
/** 64 kbps mono speech: small, and indistinguishable from more on a phone. */
const OUTPUT_FORMAT = 'mp3_44100_64';
const DEFAULT_DAILY_CHARACTERS = 20000;

/**
 * The game's languages ElevenLabs lists for v3 (its models page, checked
 * 2026-09-26). The admin screen lists these first; others can still be
 * tried, since the list is theirs to grow.
 */
export const V3_LANGUAGES = Object.freeze([
  'afr', 'arb', 'hye', 'asm', 'azj', 'bel', 'ben', 'bos', 'bul', 'cat', 'ceb', 'nya', 'hrv', 'ces',
  'dan', 'nld', 'est', 'tgl', 'fin', 'fra', 'glg', 'kat', 'deu', 'ell', 'guj', 'hau', 'heb', 'hin',
  'hun', 'isl', 'ind', 'gle', 'ita', 'jpn', 'jav', 'kan', 'kaz', 'kir', 'kor', 'lav', 'lin', 'lit',
  'ltz', 'mkd', 'zsm', 'mal', 'cmn', 'mar', 'npi', 'nob', 'pbu', 'pes', 'pol', 'por', 'pan', 'ron',
  'rus', 'srp', 'snd', 'slk', 'slv', 'som', 'spa', 'swh', 'swe', 'tam', 'tel', 'tha', 'tur', 'ukr',
  'urd', 'vie', 'cym',
]);

/** ElevenLabs voice ids are short runs of letters and digits. */
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;

export class VoiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The languages switched on for Voices, as { code: voiceId }. */
export async function enabledVoices({ store = prisma } = {}) {
  const rows = await store.geoVoiceLanguage.findMany({ where: { enabled: true } });
  return Object.fromEntries(rows.filter((row) => row.voiceId).map((row) => [row.language, row.voiceId]));
}

/** Every language's voice setting, for the admin screen. */
export async function voiceSettings({ store = prisma } = {}) {
  const [rows, counts] = await Promise.all([
    store.geoVoiceLanguage.findMany(),
    store.geoVoiceClip.groupBy({ by: ['language'], _count: { _all: true } }),
  ]);
  const clips = Object.fromEntries(counts.map((row) => [row.language, row._count._all]));
  return Object.fromEntries(rows.map((row) => [row.language, { voiceId: row.voiceId, enabled: row.enabled, clips: clips[row.language] || 0 }]));
}

/** Set a language's voice, or switch it on or off. A voice is required to switch one on. */
export async function saveVoiceSetting({ language, voiceId, enabled }, { store = prisma } = {}) {
  if (typeof language !== 'string' || !/^[a-z]{3}$/.test(language)) throw new VoiceError('bad_language', 'Name the language by its three-letter code');
  const id = typeof voiceId === 'string' ? voiceId.trim() : '';
  if (id && !VOICE_ID.test(id)) throw new VoiceError('bad_voice', 'That does not look like an ElevenLabs voice id');
  if (enabled && !id) throw new VoiceError('no_voice', 'Give the language a voice before switching it on');
  return store.geoVoiceLanguage.upsert({
    where: { language },
    create: { language, voiceId: id, enabled: Boolean(enabled) },
    update: { voiceId: id, enabled: Boolean(enabled) },
  });
}

/**
 * The voices on the ElevenLabs account, for the admin screen's picker:
 * the ones in "My Voices" plus ElevenLabs' own. Listing costs nothing.
 * An empty list when there is no key or the key may not list voices;
 * a voice id can always be pasted instead.
 */
export async function accountVoices({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetchImpl(`${API}/voices`, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const body = await response.json();
    return (Array.isArray(body?.voices) ? body.voices : [])
      .filter((voice) => typeof voice?.voice_id === 'string' && VOICE_ID.test(voice.voice_id))
      .map((voice) => ({
        id: voice.voice_id,
        name: String(voice.name || voice.voice_id).slice(0, 80),
        about: [voice.labels?.accent, voice.labels?.language, voice.labels?.gender].filter(Boolean).join(', ').slice(0, 80),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function clipKey({ voiceId, text }) {
  return createHash('sha256').update(`${VOICE_MODEL}|${voiceId}|${text}`).digest('hex');
}

const startOfDay = (now) => {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  return day;
};

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
export async function clipAudio({ language, voiceId, text }, options = {}) {
  const key = clipKey({ voiceId, text });
  if (making.has(key)) return making.get(key);
  const job = makeClip({ key, language, voiceId, text }, options).finally(() => making.delete(key));
  making.set(key, job);
  return job;
}

async function makeClip({ key, language, voiceId, text }, { store = prisma, fetchImpl = globalThis.fetch, env = process.env, now = Date.now() } = {}) {
  const stored = await store.geoVoiceClip.findUnique({ where: { key }, select: { audio: true } });
  if (stored) return Buffer.from(stored.audio);

  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new VoiceError('no_key', 'Voices are not set up on this server: ELEVENLABS_API_KEY is missing');
  const chars = [...text].length;
  const cap = Number(env.GEO_VOICE_DAILY_CHARACTERS) || DEFAULT_DAILY_CHARACTERS;
  const today = await store.geoVoiceClip.aggregate({ _sum: { chars: true }, where: { createdAt: { gte: startOfDay(now) } } });
  if ((today?._sum?.chars || 0) + chars > cap) throw new VoiceError('daily_cap', 'Today\'s new voice audio has reached its limit; stored clips still play');

  let response;
  try {
    response = await fetchImpl(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: VOICE_MODEL }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    console.error('[geo/voice] ElevenLabs unreachable', error?.message || error);
    throw new VoiceError('upstream', 'ElevenLabs did not answer');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[geo/voice] ElevenLabs', response.status, detail.slice(0, 300));
    throw new VoiceError('upstream', `ElevenLabs could not make the audio (${response.status})`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  await store.geoVoiceClip.upsert({
    where: { key },
    create: { key, language, voiceId, model: VOICE_MODEL, text, chars, audio },
    update: {},
  });
  return audio;
}
