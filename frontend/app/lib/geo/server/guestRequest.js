/**
 * The guest pass's request side: the refusal as a response. Kept apart
 * from guestPass.js so its tests never load next/server.
 *
 * The round routes do not make a play profile for a request that has
 * none. That would write a row for every headerless request, which is
 * what a scraper sends. The play pages make one before their first
 * round (lib/profile.js, ensureProfile), and a request that still has
 * none is counted by its address alone, against the address backstop.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest } from './identity';
import { subjectsFor as defaultSubjectsFor } from './meterRequest';

/**
 * The subjects behind a round request. A signed-in account with no play
 * profile yet is given its own, once, so it is never counted as a guest:
 * an account is a person behind a sealed cookie, unlike a headerless
 * request, which is never given one.
 */
export async function roundSubjects(request, subjectsFor = defaultSubjectsFor) {
  const subjects = await subjectsFor(request);
  if (subjects.profileId || !accountFromRequest(request).accountId) return subjects;
  return subjectsFor(request, { createIfMissing: true });
}

export function guestPassErrorResponse(error) {
  const retryAfter = Math.max(1, Math.ceil(((error.resetAt || Date.now() + 60000) - Date.now()) / 1000));
  return NextResponse.json(
    { error: error.message, code: error.code, resetAt: error.resetAt || null, network: Boolean(error.network), limit: error.limit || null },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } }
  );
}
