/**
 * The sentences the desk says about the people on a search, and what a
 * helper's card shows of what was said to them. Pure, so each is tested
 * (__tests__/lib/searchTeamWords.test.js).
 *
 * Like every sentence on the desk (lib/insight.js) these are counts and
 * times from the search itself. A message is always shown as someone's
 * own words, with whose they are; the screen adds none.
 */
import { inWords, outLongAfter } from '@/app/lib/searchCircle';
import { clockTime, dayAndTime } from './words';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** How long a word stays on a helper's card. After it, the card goes back to the job. */
export const WORD_FRESH_MS = 12 * HOUR;

/** What one person is doing, in a line: for the People list on the desk. `unit` is what the search hands out. */
export function personLine(person, { timeZone, now = Date.now(), unit = 'street' } = {}) {
  if (!person) return '';
  if (unit === 'area') {
    // Ground is searched, not walked, and an area's name goes into the sentence as "the west side".
    if (person.state === 'walking' && person.on) return `Searching ${inWords(person.on.title)} since ${clockTime(person.since, timeZone)}`;
    if (person.state === 'asked' && person.asked) {
      const what = `Asked to search ${inWords(person.asked.title)} at ${clockTime(person.asked.at, timeZone)}`;
      return person.asked.seenAt ? `${what}. Seen ${clockTime(person.asked.seenAt, timeZone)}.` : `${what}. Not seen yet.`;
    }
    if (person.walked > 0 && person.lastWalkedAt) return `Free since ${dayAndTime(person.lastWalkedAt, timeZone, now)}. Searched ${person.walked === 1 ? '1 area' : `${person.walked} areas`}.`;
    if (person.joinedAt) return `Joined ${dayAndTime(person.joinedAt, timeZone, now)}. No area yet.`;
    return 'No area yet.';
  }
  const thing = unit === 'block' ? 'block' : 'street';
  if (person.state === 'walking' && person.on) return `Walking ${shortTitle(person.on.title)} since ${clockTime(person.since, timeZone)}`;
  if (person.state === 'asked' && person.asked) {
    const what = `Asked to walk ${shortTitle(person.asked.title)} at ${clockTime(person.asked.at, timeZone)}`;
    return person.asked.seenAt ? `${what}. Seen ${clockTime(person.asked.seenAt, timeZone)}.` : `${what}. Not seen yet.`;
  }
  if (person.walked > 0 && person.lastWalkedAt) return `Free since ${dayAndTime(person.lastWalkedAt, timeZone, now)}. Walked ${person.walked === 1 ? `1 ${thing}` : `${person.walked} ${thing}s`}.`;
  if (person.joinedAt) return `Joined ${dayAndTime(person.joinedAt, timeZone, now)}. No ${thing} yet.`;
  return `No ${thing} yet.`;
}

/** "Ramsey Ave" from "Ramsey Ave from W 40th St to W 44th St": the list has room for the name, the card says the rest. */
export function shortTitle(title) {
  return String(title || '').split(' from ')[0];
}

/**
 * Someone out much longer than their area takes: how many minutes, or
 * null. Twice the area's time and a quarter of an hour, so a careful
 * search is never flagged (app/lib/searchCircle.js, outLongAfter: the site
 * goes on counting them as there for half an hour after that, so this is
 * always said first). `minutes` is how long the area takes.
 */
export function outLong(person, minutes, now = Date.now()) {
  if (!person || person.state !== 'walking' || !person.since) return null;
  const out = Math.round((now - new Date(person.since).getTime()) / MINUTE);
  return out > outLongAfter(minutes) ? out : null;
}

/** People in the order the desk lists them, in three groups. */
export function grouped(people = []) {
  return {
    free: people.filter((p) => p.state === 'free'),
    asked: people.filter((p) => p.state === 'asked'),
    walking: people.filter((p) => p.state === 'walking'),
  };
}

/** How many words written to one person their card shows at once. */
export const WORDS_ON_CARD = 3;

/**
 * What a helper's card shows of what was said: the words written to them
 * from the desk since they last wrote back (the newest three, oldest
 * first), or else the newest one, and then the newest thing the owner told
 * everyone; each while it is fresh. A word written to this person is
 * always there while it is fresh: the desk is told when it was seen, so it
 * has to be on the card to see, and something told to everyone later must
 * not push it off. Each: { id, kind: 'yours' | 'everyone', text, at, from,
 * seen, waiting }. `from` is the owner's first name, or null for a word
 * from anyone else who came to run the search (a helper is not told their
 * name).
 *
 * `waiting` says whether a word is still to be dealt with: written to this
 * person since they last wrote back, or told to everyone, and not put away
 * ("Got it"; `put` is what this phone has put away). A card whose words
 * have all been dealt with shows them as one line (`dealtLine`) and gives
 * the map its room back: a word stays for twelve hours, and on a small
 * phone a card that tall leaves a strip of map.
 */
export function wordsForCard({ words = [], updates = [], ownerName = null, now = Date.now(), put = new Set() } = {}) {
  const fresh = (at) => at && now - new Date(at).getTime() < WORD_FRESH_MS;
  const theirs = words.filter((w) => !w.mine && fresh(w.at));
  // Those since this person last wrote back are the ones still to answer.
  const lastMine = words.reduce((last, w, i) => (w.mine ? i : last), -1);
  const since = words.slice(lastMine + 1).filter((w) => !w.mine && fresh(w.at));
  const direct = (since.length ? since : theirs.slice(-1)).slice(-WORDS_ON_CARD);
  const told = updates.find((u) => fresh(u.at));
  const kept = (id) => put.has(`word-${id}`);
  return [
    ...direct.map((w) => ({ id: w.id, kind: 'yours', text: w.text, at: w.at, from: w.from || null, seen: w.seen !== false, waiting: since.includes(w) && !kept(w.id) })),
    ...(told ? [{ id: told.id, kind: 'everyone', text: told.text, at: told.at, from: ownerName || null, seen: true, waiting: !kept(told.id) }] : []),
  ];
}

/**
 * The one line a helper's card shows in place of words that have all been
 * dealt with: that this person answered, or whose the newest word was, and
 * when. `said` is wordsForCard's list and `words` this person's messages
 * with the desk, oldest first. '' when nothing was said.
 */
export function dealtLine({ said = [], words = [], timeZone, now = Date.now() } = {}) {
  if (!said.length) return '';
  const newest = said.reduce((last, w) => (!last || new Date(w.at) > new Date(last.at) ? w : last), null);
  const who = newest.from || 'the people running the search';
  const mine = [...words].reverse().find((w) => w.mine);
  if (mine && new Date(mine.at) >= new Date(newest.at)) return `You answered ${who} ${whenWords(mine.at, timeZone, now)}`;
  const Who = newest.from || 'The people running the search';
  return newest.kind === 'everyone' ? `${Who} told everyone ${whenWords(newest.at, timeZone, now)}` : `${Who} wrote to you ${whenWords(newest.at, timeZone, now)}`;
}

/** "at 9:57 pm" today, "yesterday at 9:57 pm" before that: a time as a sentence takes it. */
function whenWords(at, timeZone, now) {
  const when = dayAndTime(at, timeZone, now);
  return /^\d/.test(when) ? `at ${when}` : when;
}

/**
 * What the owner's phone card shows of what helpers said: the words nobody
 * running the search has answered, while they are fresh, oldest first,
 * each with whose it is and the handle to answer them by. The card shows
 * the first and says how many wait behind it, so a newer word never takes
 * the place of the one being answered. On a computer the same words are in
 * "Needs you" and in Messages. A phone has one card, so this is where an
 * owner who is out searching reads a helper's word and answers it; without
 * it a helper's answer would reach nobody who is not at a desk.
 * `talk` is every message of the search, as the picture sends it to whoever
 * runs it. `put` is the set of cards this person has put away ("Got it").
 */
export function wordsForOwner({ talk = [], put = new Set(), now = Date.now() } = {}) {
  const fresh = (at) => at && now - new Date(at).getTime() < WORD_FRESH_MS;
  return unanswered(talk)
    .filter((w) => fresh(w.at) && w.fromHandle && !put.has(`word-${w.id}`))
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .map((w) => ({ id: w.id, kind: 'yours', text: w.text, at: w.at, from: w.from || 'A helper', handle: w.fromHandle, about: w.about || null, seen: true }));
}

/** Whose a word on a helper's card is, as its label says it. */
export function wordFrom(word, { timeZone, now = Date.now() } = {}) {
  if (!word) return '';
  const who = word.from || 'The people running the search';
  return `${who}, ${dayAndTime(word.at, timeZone, now)}${word.kind === 'everyone' ? ', to everyone' : ''}`;
}

/**
 * The desk's Messages: everything said and everything that happened, in
 * one stream, oldest first. `events` are lib/insight.js `activity` rows
 * (newest first), `words` the search's messages as the picture sends them
 * to the people running it. Each line: { id, at, kind: 'event' | 'seen' |
 * 'said' | 'mine' | 'theirs', text, who, to, seenAt, streetId,
 * sightingId, handle }.
 */
export function stream({ events = [], words = [] } = {}) {
  const lines = [];
  for (const e of events) {
    lines.push({ id: e.id, at: e.at, kind: e.kind === 'seen' ? 'seen' : e.kind === 'said' ? 'said' : 'event', text: e.text, streetId: e.streetId || null, sightingId: e.sightingId || null });
  }
  for (const w of words) {
    lines.push({
      id: `word-${w.id}`,
      at: w.at,
      kind: w.fromDesk ? 'mine' : 'theirs',
      text: w.text,
      who: w.mine ? 'You' : w.from,
      to: w.to || null,
      seenAt: w.seenAt || null,
      handle: w.fromDesk ? w.toHandle : w.fromHandle,
      // What the screen knew it was about (a street), shown beside the words.
      about: w.about || null,
    });
  }
  return lines.filter((l) => l.at).sort((a, b) => new Date(a.at) - new Date(b.at));
}

/** Words from helpers that nobody at the desk has answered since: the newest per person. Never the reader's own. */
export function unanswered(words = []) {
  const last = new Map();
  for (const w of words) {
    const key = w.fromDesk ? w.toHandle : w.fromHandle;
    if (!key) continue;
    last.set(key, w);
  }
  return [...last.values()].filter((w) => !w.fromDesk && !w.mine).sort((a, b) => new Date(b.at) - new Date(a.at));
}
