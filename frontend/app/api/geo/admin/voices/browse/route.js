/**
 * GET /api/geo/admin/voices/browse?source=library&language=<iso>&search=&gender=&page=
 * GET /api/geo/admin/voices/browse?source=account&search=
 *
 * Voices to add on /geo/admin/voices: ElevenLabs' Voice Library, filtered
 * by the language a voice speaks, or the voices already in the account
 * (server/voice.js). Listing costs nothing; the previews are ElevenLabs'
 * own samples.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { accountVoices, libraryVoices, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    if (url.searchParams.get('source') === 'account') {
      return NextResponse.json({ voices: await accountVoices({ search }), hasMore: false }, { headers: NO_STORE });
    }
    const found = await libraryVoices({
      language: url.searchParams.get('language') || '',
      search,
      gender: url.searchParams.get('gender') || '',
      page: url.searchParams.get('page') || 0,
    });
    return NextResponse.json(found, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403, headers: NO_STORE });
    if (error instanceof VoiceError) {
      const message = error.detail ? `${error.message}: ${error.detail}` : error.message;
      return NextResponse.json({ error: message, code: error.code }, { status: error.code === 'no_key' ? 503 : 502, headers: NO_STORE });
    }
    console.error('[geo/admin/voices/browse]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, headers: NO_STORE });
  }
}
