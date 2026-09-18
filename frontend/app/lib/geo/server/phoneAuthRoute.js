import { NextResponse } from 'next/server';
import { GeoAuthError } from './accounts';

export const phoneResponseOptions = { headers: { 'Cache-Control': 'no-store' } };

export async function phoneBody(request) {
  const text = await request.text();
  if (text.length > 8000) throw new GeoAuthError('bad_request', 'The request is too large.');
  try { return JSON.parse(text); } catch { throw new GeoAuthError('bad_request', 'Send a valid request.'); }
}

export function phoneErrorResponse(error) {
  const known = error instanceof GeoAuthError;
  const code = known ? error.code : 'phone_unavailable';
  const status = code === 'phone_rate_limited' ? 429 : code === 'phone_not_configured' ? 503 : code === 'phone_send_failed' ? 502 : known ? 400 : 503;
  // Do not log OTPs, phone numbers, provider responses or sealed challenges.
  if (!known) console.error('[geo/phone] sign-in unavailable');
  return NextResponse.json({ error: known ? error.message : 'Could not sign in. Please try again.', code }, { status, ...phoneResponseOptions });
}
