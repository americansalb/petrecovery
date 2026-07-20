import { NextResponse } from 'next/server';

/**
 * DISABLED pre-launch.
 *
 * The legacy donation checkout was half-built (no Stripe webhook, no
 * reconciliation) and could authorize a real card with no record. It has no
 * UI caller. Payments are being rebuilt properly for the ad-boost feature;
 * until then this endpoint charges nothing and returns 410 Gone. Do not
 * re-enable — build on the new boost payment flow instead.
 */

const GONE = () =>
  NextResponse.json({ error: 'This payment endpoint is disabled.' }, { status: 410 });

export async function POST() {
  return GONE();
}

export async function GET() {
  return GONE();
}
