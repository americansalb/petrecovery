/**
 * The pet's share link, /join/[id]: the link an owner or a Rescue Force
 * pastes into a text or a group chat to bring people to a search.
 *
 * People are sent straight on to the search screen
 * (/mission-control?mission=...), which opens with no account: the streets
 * around where the pet was lost, one street to walk for anyone who joins
 * with a first name, and "I've seen" for a witness. Link preview bots
 * never run that redirect. They read the tags served here, so a texted
 * link unfurls as the ask, "Join the search for Max", with the pet's own
 * photo (docs/LINK_PREVIEWS.md, "Legacy redirect routes still need cards").
 */
import prisma from '@/app/lib/prisma';
import {
  missionWhere,
  missionShareSelect,
  missionShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import { Suspense } from 'react';
import JoinRedirect from './JoinRedirect';

export async function generateMetadata({ params }) {
  try {
    const mission = await prisma.case.findFirst({
      where: missionWhere(params.missionId),
      select: missionShareSelect,
    });
    if (!mission) return genericShareMetadata();
    return missionShareMetadata(mission, { variant: 'join' });
  } catch (error) {
    console.error('Error generating join metadata:', error);
    return genericShareMetadata();
  }
}

// The client reads ?action= with useSearchParams, which needs a Suspense
// boundary above it or the build refuses to prerender the route.
export default function JoinMissionPage() {
  return (
    <Suspense fallback={null}>
      <JoinRedirect />
    </Suspense>
  );
}
