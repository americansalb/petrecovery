import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getBaseUrl } from '@/app/lib/config';
import { missionWhere } from '@/app/lib/shareMetadata';

/**
 * GET /sightings/report?alertId=<pet> - the older "report a sighting" page.
 *
 * It was a form of its own that needed an account and sent to a route
 * that failed every time, so nobody who came here could report anything.
 * A sighting is sent from the search screen (where on the map, and when,
 * with no account), and this address now goes straight there with the
 * form open. The "Report a sighting" buttons on a pet's alert page still
 * link here.
 *
 * A redirect, like the flyer's short link (app/p/[code]/route.js), so
 * whoever is sent this address lands on a page that unfurls as the pet.
 */
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const base = getBaseUrl();
  const { searchParams } = new URL(request.url);
  const named = searchParams.get('alertId') || searchParams.get('missionId') || searchParams.get('mission');
  // No pet named, or one that does not exist: the board, where every lost pet is.
  if (!named || named.length > 100) return NextResponse.redirect(`${base}/lost-and-found`, 302);

  let pet = null;
  try {
    pet = await prisma.case.findFirst({ where: missionWhere(named), select: { caseNumber: true } });
  } catch (error) {
    console.error('[sightings/report] lookup failed:', error?.message || error);
  }
  if (!pet?.caseNumber) return NextResponse.redirect(`${base}/lost-and-found`, 302);
  return NextResponse.redirect(`${base}/mission-control?mission=${encodeURIComponent(pet.caseNumber)}&action=sighting`, 302);
}
