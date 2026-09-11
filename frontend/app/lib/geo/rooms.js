/**
 * Multiplayer rooms: the rules, as pure functions shared by the server,
 * the room pages and the tests. Everything that touches a database or a
 * clock lives in server/rooms.js.
 *
 * A room is a code, a name, a fixed game config, a variant, and a phase:
 *   lobby -> loading -> guessing -> reveal -> loading -> ... -> finished
 * Everyone plays the same rounds on the same clock. Classic totals points;
 * duel starts everyone at 6,000 HP and the round's best guess deals the
 * difference as damage, with a multiplier that climbs every three rounds.
 */

import { MAX_ROUND_SCORE } from './distance';
import { MODES, formatLabel, formatOf, normalizeConfig } from './modes';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 20;
export const MAX_ROOM_NAME_LENGTH = 40;

export const ROOM_MODES = ['balanced', 'world', 'continent', 'country', 'cities'];
export const ROOM_ROUND_OPTIONS = [3, 5, 10];
export const ROOM_TIME_OPTIONS = [30, 60, 90, 120, 180];
export const DEFAULT_ROOM_TIME = 60;

export const VARIANTS = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Everyone guesses the same places. Most points after the last round wins.',
  },
  duel: {
    id: 'duel',
    label: 'Duel',
    description:
      'Everyone starts with 6,000 HP. Each round the best guess deals the point difference as damage to everyone else. Last one standing wins.',
  },
};

export const DUEL_START_HP = 6000;
export const REVEAL_SECONDS = 12;
export const FINAL_REVEAL_SECONDS = 8;
export const GUESS_GRACE_MS = 2500;
export const ONLINE_WINDOW_MS = 30 * 1000;
export const LOADING_TIMEOUT_MS = 25 * 1000;
export const ROOM_LISTING_WINDOW_MS = 20 * 60 * 1000;
export const REACTION_EMOJI = ['🔥', '😂', '🎯', '😱', '👏', '🤔'];
export const MAX_REACTIONS_KEPT = 30;

/** Distinct, readable on dark and light maps. */
export const PLAYER_COLORS = [
  '#facc15', '#22c55e', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa',
  '#f87171', '#2dd4bf', '#e879f9', '#a3e635', '#60a5fa', '#fbbf24',
];

// Control characters and the delete character, written as escapes.
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, 'g');

export function pickColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

/** Six characters from an alphabet without look-alikes. */
export function roomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input) {
  const code = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === ROOM_CODE_LENGTH ? code : '';
}

/** A player name: printable, trimmed, capped; a fallback when empty. */
export function sanitizeName(input, fallback = 'Player') {
  const cleaned = String(input || '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || fallback;
}

export function sanitizeRoomName(input, fallback = 'WanderGuesser') {
  const cleaned = String(input || '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ROOM_NAME_LENGTH)
    .trim();
  return cleaned || fallback;
}

/** "Ada Lovelace" -> "AL", "ada" -> "AD" */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Room settings from any input. Multiplayer is Google only, needs a
 * timer so rounds end, and leaves out the daily and streak modes.
 */
export function normalizeRoomConfig(input = {}) {
  const raw = input || {};
  // Apple Look Around rooms play the modes Apple imagery supports (city
  // streets); everything else is Google Street View.
  const provider = raw.provider === 'apple' ? 'apple' : 'google';
  const supported = ROOM_MODES.filter((id) => MODES[id]?.providers?.includes(provider));
  const mode = supported.includes(raw.mode) ? raw.mode : supported.includes('balanced') ? 'balanced' : supported[0];
  const config = normalizeConfig({
    ...raw,
    provider,
    mode,
    rounds: ROOM_ROUND_OPTIONS.includes(Number(raw.rounds)) ? Number(raw.rounds) : 5,
    seed: raw.seed,
  });
  // The solo game's timer options differ; rooms have their own list.
  config.time = ROOM_TIME_OPTIONS.includes(Number(raw.time)) ? Number(raw.time) : DEFAULT_ROOM_TIME;
  const variant = VARIANTS[raw.variant] ? raw.variant : 'classic';
  const visibility = raw.visibility === 'private' ? 'private' : 'public';
  return { config, variant, visibility };
}

/** Duel damage grows every three rounds so late rounds decide it. */
export function roundMultiplier(index) {
  return 1 + 0.5 * Math.floor(Math.max(0, index) / 3);
}

/**
 * Duel: damage to each player is the gap to the round's best score,
 * times the round multiplier. The best guess takes none.
 */
export function duelDamages(scoresById, index) {
  const scores = Object.values(scoresById);
  const best = scores.length ? Math.max(...scores) : 0;
  const multiplier = roundMultiplier(index);
  const out = {};
  for (const [id, score] of Object.entries(scoresById)) {
    out[id] = Math.max(0, Math.round((best - score) * multiplier));
  }
  return { damages: out, best, multiplier };
}

/** Rank guesses by score; equal scores share a rank. */
export function rankGuesses(guesses) {
  const sorted = guesses
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  let rank = 0;
  let lastScore = null;
  return sorted.map((g, i) => {
    if (g.score !== lastScore) {
      rank = i + 1;
      lastScore = g.score;
    }
    return { ...g, rank };
  });
}

export function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
}

/** Standings for the scoreboard: classic by points, duel by HP. */
export function sortStandings(players, variant = 'classic') {
  const list = players.slice();
  if (variant === 'duel') {
    list.sort(
      (a, b) =>
        Number(Boolean(a.eliminated)) - Number(Boolean(b.eliminated)) ||
        (b.hp || 0) - (a.hp || 0) ||
        (b.score || 0) - (a.score || 0) ||
        String(a.name).localeCompare(String(b.name))
    );
  } else {
    list.sort(
      (a, b) =>
        (b.score || 0) - (a.score || 0) ||
        (b.roundWins || 0) - (a.roundWins || 0) ||
        String(a.name).localeCompare(String(b.name))
    );
  }
  return list;
}

/** True when the game has no more rounds to play. */
export function isGameOver({ variant, roundIndex, roundsTotal, players }) {
  const present = players.filter((p) => !p.leftAt);
  const alive = present.filter((p) => !p.eliminated);
  if (variant === 'duel' && present.length >= 2 && alive.length <= 1) return true;
  return roundIndex + 1 >= roundsTotal;
}

export function maxScoreFor(roundsPlayed) {
  return roundsPlayed * MAX_ROUND_SCORE;
}

/** "Waiting in the lobby", "Round 3 of 5", "Finished" */
export function describeRoomStatus(room) {
  if (room.status === 'finished') return 'Finished';
  if (room.status === 'lobby') return 'Waiting in the lobby';
  return `Round ${room.roundIndex + 1} of ${room.config?.rounds || '?'}`;
}

export function describeRoomMode(config, { regionLabel } = {}) {
  const mode = MODES[config?.mode];
  if (!mode) return config?.mode || '';
  if (mode.needs === 'continent') return `Continent: ${regionLabel || config.region}`;
  if (mode.needs === 'country') return `Country: ${regionLabel || config.region}`;
  return mode.label;
}

/** "City streets, No Move, on Apple Look Around": the room card's one line. */
export function describeRoomRules(config, { regionLabel } = {}) {
  const parts = [describeRoomMode(config, { regionLabel })];
  if (formatOf(config) !== 'moving') parts.push(formatLabel(config));
  if (config?.provider === 'apple') parts.push('on Apple Look Around');
  return parts.join(', ');
}
