/**
 * Mission Control: the search view of one pet's page
 * (/mission-control?mission=<case number>).
 *
 * One mission, three instruments: a desk sees and plans, a phone browser
 * joins, takes an area of ground to search and reports a sighting, and
 * the app does all of that and records the walk with GPS. SearchScreen
 * picks the layout and the step.
 *
 * The screen is open to anyone holding the link, so the address gets
 * pasted into chats: this server page gives it the pet's own link preview
 * (docs/LINK_PREVIEWS.md). Preview bots do not run the screen.
 */
import prisma from '@/app/lib/prisma';
import { missionWhere, missionShareSelect, missionShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import SearchScreen from './SearchScreen';

/**
 * The search screen takes the whole phone, edge to edge, and keeps its own
 * bar and buttons clear of the clock, the notch and the browser's bars with
 * env(safe-area-inset-*) (SearchScreen.js, TopBar.js, PhotoView.js). Those
 * read 0 unless the page asks for the whole screen, which only this route
 * does: the rest of the site does not pad for a notch. Merged with the root
 * layout's viewport.
 */
export const viewport = { viewportFit: 'cover' };

export async function generateMetadata({ searchParams }) {
  const param = searchParams?.mission || searchParams?.caseId;
  if (!param || typeof param !== 'string') return genericShareMetadata();
  try {
    const mission = await prisma.case.findFirst({ where: missionWhere(param), select: missionShareSelect });
    if (!mission) return genericShareMetadata();
    return missionShareMetadata(mission, { variant: 'join' });
  } catch (error) {
    console.error('Error generating search metadata:', error);
    return genericShareMetadata();
  }
}

export default function MissionControl() {
  return <SearchScreen />;
}
