import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { cleanTeamPost } from '@/app/rasuwa/team/teamLogic';

/**
 * POST /api/rasuwa/team/posts { author, body, kind } - one board post:
 * kind "message" is the running conversation, kind "update" stays
 * pinned at the top. Author is whatever name the person typed; the
 * board is a closed group on a shared code and works on trust, like
 * names on a sign-in sheet. Board cookie required.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request) {
  if (!hasTeamCookie(request)) {
    return NextResponse.json({ error: 'join' }, { status: 401, ...NO_STORE });
  }
  let input = null;
  try {
    input = await request.json();
  } catch {
    // cleanTeamPost(null) rejects below
  }
  const post = cleanTeamPost(input || {});
  if (!post) {
    return NextResponse.json(
      { error: 'A post needs your name and something to say.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    const created = await prisma.rasuwaTeamPost.create({ data: post });
    return NextResponse.json({ post: created }, NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'The board could not save that. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
