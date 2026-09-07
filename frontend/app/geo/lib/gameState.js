/**
 * The game as a pure reducer, so the play page's flow can be tested
 * without a browser.
 *
 * status: idle -> loading -> (locating, Apple only) -> playing ->
 *         submitting -> result -> idle ... -> summary
 *         with error reachable from loading/locating and back via retry.
 */

import { MAX_ROUND_SCORE } from '@/app/lib/geo/distance';

export function createInitialState(config) {
  return {
    config,
    status: 'idle',
    roundIndex: 0,
    attempt: 0,
    rounds: [],
    current: null,
    pin: null,
    error: null,
    roundStartedAt: null,
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'load_start':
      return { ...state, status: 'loading', current: null, pin: null, error: null };
    case 'load_success': {
      const round = action.round;
      if (round.provider === 'apple') {
        return { ...state, status: 'locating', current: round, pin: null, error: null };
      }
      return { ...state, status: 'playing', current: round, pin: null, error: null, attempt: 0, roundStartedAt: action.now ?? Date.now() };
    }
    case 'located': {
      if (!state.current) return state;
      const candidate = state.current.candidates?.[action.index];
      if (!candidate) return state;
      return {
        ...state,
        status: 'playing',
        current: { ...state.current, token: candidate.token, candidateIndex: action.index, candidate },
        attempt: 0,
        roundStartedAt: action.now ?? Date.now(),
      };
    }
    case 'load_error':
      return { ...state, status: 'error', error: action.error };
    case 'retry':
      return { ...state, status: 'idle', error: null, attempt: state.attempt + 1 };
    case 'pin':
      return state.status === 'playing' ? { ...state, pin: action.pin } : state;
    case 'submit_start':
      return state.status === 'playing' ? { ...state, status: 'submitting' } : state;
    case 'submit_error':
      return { ...state, status: 'playing', error: action.error };
    case 'submit_success':
      return { ...state, status: 'result', error: null, rounds: [...state.rounds, action.result] };
    case 'next':
      // Only from a result: Space triggers both the focused button and the
      // window key handler, and a second 'next' must not skip a round.
      if (state.status !== 'result') return state;
      if (isFinished(state)) return { ...state, status: 'summary', current: null, pin: null };
      return { ...state, status: 'idle', roundIndex: state.roundIndex + 1, current: null, pin: null, error: null };
    case 'finish':
      return { ...state, status: 'summary', current: null, pin: null };
    case 'restart':
      return createInitialState(action.config || state.config);
    default:
      return state;
  }
}

export function isStreak(state) {
  return state.config.mode === 'streak';
}

/** True once the last needed round has a result. */
export function isFinished(state) {
  if (isStreak(state)) {
    const last = state.rounds[state.rounds.length - 1];
    return Boolean(last && !last.correct);
  }
  return state.rounds.length >= state.config.rounds;
}

export function totalScore(state) {
  return state.rounds.reduce((sum, r) => sum + (r.score || 0), 0);
}

export function streakLength(state) {
  return state.rounds.filter((r) => r.correct).length;
}

export function maxScore(state) {
  return (isStreak(state) ? state.rounds.length : state.config.rounds) * MAX_ROUND_SCORE;
}

/** Everything the share code and the local history need. */
export function buildSummary(state, { date = new Date() } = {}) {
  return {
    config: state.config,
    rounds: state.rounds.map((r) => ({
      score: r.score || 0,
      distanceKm: r.distanceKm ?? null,
      correct: Boolean(r.correct),
      country: r.answer?.country || null,
      guess: r.guess || null,
      answer: r.answer ? { lat: r.answer.lat, lng: r.answer.lng } : null,
      guessCountry: r.guessCountry || '',
      timedOut: Boolean(r.timedOut),
    })),
    total: totalScore(state),
    streak: streakLength(state),
    date: date.toISOString().slice(0, 10),
  };
}
