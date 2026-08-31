import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { LETTER_RECORD_CAPS } from '@/app/rasuwa/letterRecord';

/**
 * POST /api/rasuwa/letters
 *
 * Saves one finished wizard pass to the families' record of generated
 * letters (founder instruction: every missing person deserves a letter
 * on record). The wizard posts when the person moves from composing to
 * delivering, and the page says a copy is saved for the families'
 * records. Write-only: there is no public read; organizers read the
 * records through /api/admin/rasuwa-letters.
 *
 * Rate limited in middleware.js ('/api/rasuwa/letters'). Payloads are
 * re-capped here so the record cannot be abused into bulk storage.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };
const clip = (v, n) => String(v || '').slice(0, n);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const letters = Array.isArray(body?.letters) ? body.letters : [];
  const personName = clip(body?.personName, LETTER_RECORD_CAPS.fieldChars).trim();
  if (!personName || letters.length === 0) {
    return NextResponse.json({ error: 'Nothing to record.' }, { status: 400, ...NO_STORE });
  }

  const capped = letters.slice(0, LETTER_RECORD_CAPS.letters).map((l) => ({
    recipient: clip(l?.recipient, LETTER_RECORD_CAPS.fieldChars),
    body: clip(l?.body, LETTER_RECORD_CAPS.bodyChars),
  }));

  try {
    await prisma.rasuwaLetterRecord.create({
      data: {
        personName,
        where: clip(body?.where, 8),
        recipients: clip(body?.recipients, 1000),
        subject: clip(body?.subject, 500),
        letters: capped,
      },
    });
    return NextResponse.json({ saved: true }, NO_STORE);
  } catch {
    return NextResponse.json({ error: 'The record could not be saved right now.' }, { status: 503, ...NO_STORE });
  }
}
