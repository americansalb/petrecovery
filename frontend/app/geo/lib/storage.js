'use client';

/**
 * Local history and stats. localStorage only: it can be empty, blocked,
 * or throw, and the game must not care.
 */

const KEY = 'geo:history:v1';
const MAX_GAMES = 100;

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_GAMES)));
  } catch {
    /* storage unavailable */
  }
}

/** Key that groups comparable games: provider, mode, region, rounds, movement, timer. */
export function statsKey(config) {
  return [config.provider, config.mode, config.region || '-', config.rounds, config.time, config.move ? 'm' : '', config.pan ? 'p' : '', config.zoom ? 'z' : ''].join(':');
}

export function recordGame(summary, shareCode) {
  const list = read();
  list.push({
    at: new Date().toISOString(),
    key: statsKey(summary.config),
    config: summary.config,
    total: summary.total,
    streak: summary.streak,
    rounds: summary.rounds.length,
    avgKm: averageKm(summary),
    code: shareCode || '',
  });
  write(list);
}

function averageKm(summary) {
  const d = summary.rounds.map((r) => r.distanceKm).filter((x) => Number.isFinite(x));
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
}

export function getHistory() {
  return read().slice().reverse();
}

export function getStats() {
  const list = read();
  const pinGames = list.filter((g) => g.config?.mode !== 'streak');
  const streaks = list.filter((g) => g.config?.mode === 'streak');
  return {
    games: list.length,
    best: pinGames.reduce((m, g) => Math.max(m, g.total || 0), 0),
    average: pinGames.length ? Math.round(pinGames.reduce((s, g) => s + (g.total || 0), 0) / pinGames.length) : 0,
    bestStreak: streaks.reduce((m, g) => Math.max(m, g.streak || 0), 0),
    dailyPlayed: list.some((g) => g.config?.mode === 'daily' && g.config?.seed === todaySeed()),
  };
}

export function bestFor(config) {
  const key = statsKey(config);
  return read()
    .filter((g) => g.key === key)
    .reduce((m, g) => Math.max(m, config.mode === 'streak' ? g.streak || 0 : g.total || 0), 0);
}

function todaySeed() {
  return `daily-${new Date().toISOString().slice(0, 10)}`;
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
