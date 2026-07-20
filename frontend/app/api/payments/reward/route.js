import { NextResponse } from 'next/server';

/**
 * DISABLED pre-launch.
 *
 * The legacy reward-escrow checkout was half-built (no Stripe webhook, no
 * reconciliation) and could authorize a real card with no record. It has no
 * UI caller. Payments are being rebuilt properly for the ad-boost feature;
 * until then this endpoint charges nothing and returns 410 Gone.
 */

const GONE = () =>
  NextResponse.json({ error: 'This payment endpoint is disabled.' }, { status: 410 });

export async function POST() {
  return GONE();
}

export async function PUT() {
  return GONE();
}

export async function GET() {
  return GONE();
}
