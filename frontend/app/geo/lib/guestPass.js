'use client';

/**
 * The guest pass from the browser's side (app/lib/geo/server/guestPass.js
 * has the rules): how many games a guest has left today, and the ticket
 * that holds one game together across its rounds and a refresh.
 *
 * One answer for the whole page. The header's chip, the menu, the round
 * and the end of a game all read the same count, and a round that starts
 * a game publishes the new count to all of them at once, so no two
 * places on screen ever disagree about how many games are left.
 */

import { useEffect, useState } from 'react';
import { profileHeaders } from './profile';

const EVENT = 'geo:guest-pass';
const TICKETS = 'geo:guest-tickets:v1';
const KEEP_TICKETS = 12;

let current = null;
let pending = null;

// Signing in turns a guest into an account without a navigation, and
// the screen that asked may not be the one that reads the count next
// (the limit screen hands over to a round). So the page's one answer is
// dropped and asked again here, whoever happens to be listening.
if (typeof window !== 'undefined') {
  window.addEventListener('geo:session-changed', () => {
    current = null;
    readGuestPass({ force: true });
  });
}

/**
 * Ask the server, once per page unless forced. Resolves to the allowance
 * ({ guest, limit, used, left, resetAt, network }) or null when the
 * server could not say: a count we do not know is shown as no count.
 */
export function readGuestPass({ force = false } = {}) {
  if (current && !force) return Promise.resolve(current);
  if (pending && !force) return pending;
  pending = fetch('/api/geo/guest', { headers: profileHeaders(), cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data?.ok) publishGuestPass(data);
      return current;
    })
    .catch(() => current)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Tell every reader on the page the new count. */
export function publishGuestPass(allowance) {
  if (!allowance) return;
  const { ok, ...rest } = allowance;
  current = rest;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
}

/** The count, kept current. null until the server has answered. */
export function useGuestPass() {
  const [pass, setPass] = useState(current);
  useEffect(() => {
    let live = true;
    const take = (event) => live && setPass(event.detail || null);
    // A sign-in is heard at module level above, and its new answer
    // arrives here as an EVENT like any other.
    window.addEventListener(EVENT, take);
    readGuestPass().then((next) => live && setPass(next));
    return () => {
      live = false;
      window.removeEventListener(EVENT, take);
    };
  }, []);
  return pass;
}

function readTickets() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TICKETS) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The ticket for a game, so its next round and a reload are not new games. */
export function ticketFor(kind, seed) {
  if (!seed) return undefined;
  return readTickets().find((row) => row.k === `${kind}:${seed}`)?.t || undefined;
}

function rememberTicket(kind, seed, ticket) {
  if (!seed || !ticket) return;
  try {
    const key = `${kind}:${seed}`;
    const rows = [...readTickets().filter((row) => row.k !== key), { k: key, t: ticket }].slice(-KEEP_TICKETS);
    window.localStorage.setItem(TICKETS, JSON.stringify(rows));
  } catch {
    /* Storage is optional: without it a reload is a new game. */
  }
}

/**
 * What a round reply carries for a guest: the game's ticket and the new
 * count. Call it with every successful round reply, Street or Script.
 */
export function takeRoundReply(kind, seed, data) {
  if (!data?.guest) return;
  if (data.guest.ticket) rememberTicket(kind, seed, data.guest.ticket);
  // A signed-in player's round says { guest: false }, which clears a
  // count left over from before they signed in.
  if (data.guest.allowance) publishGuestPass(data.guest.allowance);
}

/** "7 h 12 min" until the games come back. */
export function untilReset(resetAt, now = Date.now()) {
  const minutes = Math.max(1, Math.round(((Number(resetAt) || now) - now) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
