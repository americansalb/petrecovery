import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * The letter wizard's collective count.
 *
 * GET  -> { counts: { letters_done, entry_sent, letter_signed } }
 * POST { action } -> increments that count by one, returns the counts.
 *
 * This is the one thing the wizard writes anywhere: an anonymous +1
 * when a family checks a finish box, so the page can show the shared
 * count move. Counts only; no names, no entries, no addresses, no IPs.
 * The page says exactly that next to the boxes; keep it true.
 *
 * Rate limited in middleware.js ('/api/rasuwa/tally').
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };
const ACTIONS = ['letters_done', 'entry_sent', 'letter_signed'];

async function readCounts() {
  const rows = await prisma.rasuwaTally.findMany({ where: { action: { in: ACTIONS } } });
  const counts = Object.fromEntries(ACTIONS.map((a) => [a, 0]));
  for (const row of rows) counts[row.action] = row.count;
  return counts;
}

export async function GET() {
  try {
    return NextResponse.json({ counts: await readCounts() }, NO_STORE);
  } catch {
    return NextResponse.json({ error: 'The count is unavailable right now.' }, { status: 503, ...NO_STORE });
  }
}

export async function POST(request) {
  let action = '';
  try {
    const body = await request.json();
    action = String(body.action || '');
  } catch {
    // fall through to the validation below
  }
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400, ...NO_STORE });
  }
  try {
    await prisma.rasuwaTally.upsert({
      where: { action },
      create: { action, count: 1 },
      update: { count: { increment: 1 } },
    });
    return NextResponse.json({ counts: await readCounts() }, NO_STORE);
  } catch {
    return NextResponse.json({ error: 'The count is unavailable right now.' }, { status: 503, ...NO_STORE });
  }
}
