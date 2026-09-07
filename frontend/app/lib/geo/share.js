/**
 * Share codes: a finished game folded into a short URL-safe string so a
 * result page and its link preview can be served with no database.
 *
 * Nothing here is authoritative (anyone can type a code); it is a
 * bragging card, not a leaderboard. Pure JavaScript, client and server.
 */

import { formatDistance, formatScore, MAX_ROUND_SCORE } from './distance';
import { describeConfig, MODES, normalizeConfig } from './modes';

const MAX_ROUNDS = 64;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (code.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

/**
 * summary: { config, rounds: [{ score, distanceKm, correct, country }], total, streak, date }
 */
export function encodeShare(summary) {
  const config = normalizeConfig(summary.config || {});
  const rounds = (summary.rounds || []).slice(0, MAX_ROUNDS).map((r) => [
    clampInt(r.score, 0, MAX_ROUND_SCORE),
    r.distanceKm === null || r.distanceKm === undefined ? -1 : Math.round(Number(r.distanceKm) * 10) / 10,
    r.correct ? 1 : 0,
    String(r.country?.code || r.countryCode || '').slice(0, 2),
  ]);
  const payload = {
    v: 1,
    p: config.provider,
    m: config.mode,
    g: config.region || '',
    n: config.rounds,
    t: config.time,
    mv: (config.move ? 1 : 0) + (config.pan ? 2 : 0) + (config.zoom ? 4 : 0),
    rd: config.radius,
    s: config.seed || '',
    d: String(summary.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    r: rounds,
  };
  return toBase64Url(JSON.stringify(payload));
}

/** Returns a summary or null if the code is not one of ours. */
export function decodeShare(code) {
  if (typeof code !== 'string' || code.length < 4 || code.length > 4000) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1 || !Array.isArray(payload.r)) return null;
  const config = normalizeConfig({
    provider: payload.p,
    mode: payload.m,
    region: payload.g,
    rounds: payload.n,
    time: payload.t,
    move: Boolean(payload.mv & 1),
    pan: Boolean(payload.mv & 2),
    zoom: Boolean(payload.mv & 4),
    radius: payload.rd,
    seed: payload.s,
  });
  const rounds = payload.r.slice(0, MAX_ROUNDS).map((row) => {
    const [score, distance, correct, country] = Array.isArray(row) ? row : [];
    return {
      score: clampInt(score, 0, MAX_ROUND_SCORE),
      distanceKm: Number(distance) < 0 || !Number.isFinite(Number(distance)) ? null : Number(distance),
      correct: correct === 1,
      countryCode: /^[A-Z]{2}$/i.test(String(country || '')) ? String(country).toUpperCase() : '',
    };
  });
  const total = rounds.reduce((sum, r) => sum + r.score, 0);
  const streak = config.mode === 'streak' ? rounds.filter((r) => r.correct).length : 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.d || '')) ? payload.d : '';
  return { config, rounds, total, streak, date };
}

/** Headline for a summary: "21,450 of 25,000" or "Streak of 7". */
export function summaryHeadline(summary) {
  if (summary.config.mode === 'streak') {
    return `Streak of ${summary.streak}`;
  }
  const max = summary.rounds.length * MAX_ROUND_SCORE;
  return `${formatScore(summary.total)} of ${formatScore(max)}`;
}

/** Average miss for pin games, or null. */
export function averageMissKm(summary) {
  const misses = summary.rounds.filter((r) => Number.isFinite(r.distanceKm)).map((r) => r.distanceKm);
  if (!misses.length) return null;
  return misses.reduce((a, b) => a + b, 0) / misses.length;
}

/** Text for the clipboard / share sheet. */
export function shareText(summary, url, { regionLabel } = {}) {
  const mode = MODES[summary.config.mode]?.label || summary.config.mode;
  const lines = [];
  if (summary.config.mode === 'streak') {
    lines.push(`Where on Earth: streak of ${summary.streak} in ${mode}.`);
  } else {
    lines.push(`Where on Earth: ${summaryHeadline(summary)} in ${describeConfig(summary.config, { regionLabel })}`);
    const avg = averageMissKm(summary);
    if (avg !== null) lines.push(`Average miss ${formatDistance(avg)}.`);
    lines.push(summary.rounds.map((r) => scoreGlyph(r.score)).join(''));
  }
  if (summary.config.seed) lines.push('Same places, your turn:');
  if (url) lines.push(url);
  return lines.join('\n');
}

/** One character per round, so a result reads at a glance in a chat. */
export function scoreGlyph(score) {
  if (score >= 4500) return '🟩';
  if (score >= 3000) return '🟨';
  if (score >= 1000) return '🟧';
  return '🟥';
}
