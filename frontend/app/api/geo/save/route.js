import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { requireAccount } from '@/app/lib/geo/server/requireAccount';
import { RateLimitPresets, withRateLimitAsync, rateLimitResponse } from '@/app/lib/geo/server/limiter';
import { safeReturnTo } from '@/app/lib/geo/authReturn';
import { sameSavedCheckpoint } from '@/app/lib/geo/server/savedCheckpoint';

export const dynamic = 'force-dynamic';
const options = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  const denied = await requireAccount(request);
  if (denied) return denied;
  const { accountId } = accountFromRequest(request);
  try {
    const account = await prismaRoomStore.getAccountById(accountId);
    return NextResponse.json({ savedGame: account?.savedGame || null, revision: account?.savedGameRevision || 0, accountId }, options);
  } catch {
    return NextResponse.json({ error: 'Could not load your saved game.' }, { status: 503, ...options });
  }
}

export async function POST(request) {
  const denied = await requireAccount(request);
  if (denied) return denied;
  const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'geo-save');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const raw = await request.text();
    if (raw.length > 512000) return NextResponse.json({ error: 'This game is too large to save.' }, { status: 413, ...options });
    let saved;
    try { saved = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Invalid saved game.' }, { status: 400, ...options });
    }
    const path = safeReturnTo(saved?.url, '');
    const expected = saved?.kind === 'street' ? '/geo/play' : saved?.kind === 'script' ? '/geo/script/play' : '';
    if (!expected || path.split('?')[0] !== expected || !saved.snapshot || !Array.isArray(saved.snapshot.rounds || saved.snapshot.history)) {
      return NextResponse.json({ error: 'Invalid saved game.' }, { status: 400, ...options });
    }
    const { accountId } = accountFromRequest(request);
    if (saved.accountId !== accountId || !Number.isSafeInteger(saved.expectedRevision) || saved.expectedRevision < 0) {
      return NextResponse.json({ error: 'Reload your saved game before syncing.', code: 'save_conflict' }, { status: 409, ...options });
    }
    // This is a private display checkpoint, not an authoritative game result.
    // Server-scored ratings and rewards never read it.
    const savedGame = { kind: saved.kind, url: path, snapshot: saved.snapshot, at: Date.now() };
    const updated = await prismaRoomStore.saveAccountGame(accountId, saved.expectedRevision, savedGame);
    if (!updated) {
      const current = await prismaRoomStore.getAccountById(accountId);
      const prior = current?.savedGame;
      // A lost acknowledgement or both signup tabs saving the same checkpoint
      // is a successful replay, not a conflicting edit.
      if (sameSavedCheckpoint(prior, savedGame)) {
        return NextResponse.json({ ok: true, revision: current.savedGameRevision, savedGame: prior }, options);
      }
      return NextResponse.json({ error: 'Another session saved newer progress. Reopen your saved game from Play to continue it.', code: 'save_conflict' }, { status: 409, ...options });
    }
    return NextResponse.json({ ok: true, revision: saved.expectedRevision + 1, savedGame }, options);
  } catch {
    return NextResponse.json({ error: 'Could not save this game. Your browser copy is still available.' }, { status: 500, ...options });
  }
}
