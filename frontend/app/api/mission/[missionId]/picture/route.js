/**
 * GET /api/mission/[missionId]/picture
 *
 * The picture of a pet's search for the search screen: the pet, where it
 * was lost, the owner's number, the sightings and what became of each,
 * how many people are out (app/lib/searchPicture.js). Open to anyone
 * holding the pet's link, with what the pet's public page already shows
 * and never a helper's name, number or position. Rate limited with room
 * for a search party behind one address (RateLimitPresets.SEARCH_READ).
 * [missionId] is the case id or the case number.
 */
import { NextResponse } from 'next/server';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { searcherFor } from '@/app/lib/searcher';
import { searchPicture } from '@/app/lib/searchPicture';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'picture');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const found = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: { id: true } });
    if (!found) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const searcher = await searcherFor(request, found.id);
    const picture = await searchPicture(found.id, { searcher });
    if (!picture) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    return NextResponse.json(picture);
  } catch (error) {
    console.error('Search picture failed:', error);
    return NextResponse.json({ error: 'The search did not load. Try again in a moment.' }, { status: 500 });
  }
}
