import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { cleanCorrection } from '@/app/rasuwa/corrections';

/**
 * POST /api/rasuwa/corrections { personName, message, contact } - a
 * public "please review this" note about a missing person's details.
 * No account: families and friends spot mistakes from the letter page
 * and the wizard, and the task force board lists what comes in.
 *
 * Everything is clipped to the caps in corrections.js; the message is
 * the only required field. Rate limited in middleware.js
 * ('/api/rasuwa/corrections').
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    // validated below
  }
  const correction = cleanCorrection(body || {});
  if (!correction) {
    return NextResponse.json(
      { error: 'Say what is wrong so the families know what to review.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    await prisma.rasuwaCorrection.create({ data: correction });
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'That did not save. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
