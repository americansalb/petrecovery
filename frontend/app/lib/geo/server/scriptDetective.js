import { createHash } from 'node:crypto';
import { createRng } from '../random';
import { languageByCode } from '../languages';
import { languagesForLadder } from '../script';
import { getGeoServerConfig } from './config';
import { openToken, sealToken } from './tokens';
import { createScriptRound, evaluateScriptGuess, ScriptGameError } from './scriptGame';

function shuffle(rows, rng) {
  const result = [...rows];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Isolated prototype: old map-only rounds/tokens are unchanged. */
export function createDetectiveRound(options = {}) {
  const round = createScriptRound(options);
  const { tokenSecret } = getGeoServerConfig(options.env);
  const payload = openToken(round.token, { secret: tokenSecret, now: options.now });
  const answer = languageByCode(payload.c);
  const rng = createRng(createHash('sha256').update(`script-detective:${tokenSecret}:${payload.seed}:${payload.i}`).digest('hex'));
  const pool = shuffle(languagesForLadder(payload.l).filter((entry) => entry.code !== answer.code), rng);
  // Similar alphabets make the words matter; never offer duplicate choices.
  const rivals = [...pool.filter((entry) => entry.script === answer.script), ...pool.filter((entry) => entry.script !== answer.script)].slice(0, 3);
  const choices = shuffle([answer, ...rivals], rng).map((entry, index) => ({ id: String(index + 1), code: entry.code, name: entry.name }));
  return {
    ...round,
    choices: choices.map(({ id, name }) => ({ id, name })),
    token: sealToken({ ...payload, v: 'script-detective-1', choices: choices.map(({ id, code }) => ({ id, code })) }, { secret: tokenSecret, now: options.now }),
  };
}

export function evaluateDetectiveGuess({ token, guess, now = Date.now(), env } = {}) {
  const { tokenSecret } = getGeoServerConfig(env);
  const payload = openToken(token, { secret: tokenSecret, now });
  if (payload.v !== 'script-detective-1' || !Array.isArray(payload.choices)) throw new ScriptGameError('wrong_round', 'Start a new Script round.');
  const selection = guess?.choice == null ? null : payload.choices.find((entry) => entry.id === guess.choice);
  if (guess?.choice != null && !selection) throw new ScriptGameError('bad_choice', 'Choose one of the languages shown.');
  const pin = guess?.pin || null;
  if (pin && (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng) || Math.abs(pin.lat) > 90 || Math.abs(pin.lng) > 180)) {
    throw new ScriptGameError('bad_pin', 'Place a valid pin on the map.');
  }
  const result = evaluateScriptGuess({ token, guess: pin, now, env });
  const correct = Boolean(selection && selection.code === payload.c);
  const languagePoints = correct ? 4000 : 0;
  const mapPoints = Math.round(result.score / 5);
  return {
    ...result, kind: 'script-detective', score: languagePoints + mapPoints,
    languagePoints, mapPoints,
    choice: selection ? { id: selection.id, name: languageByCode(selection.code).name, correct } : null,
  };
}
