/**
 * A Rescue Force's page: the map, the header and the three tabs (Pets,
 * Needs, Discussion) around whichever tab is open. The data is read once
 * per request (app/lib/forcePage.js) and shared with the tab's page.
 *
 * The force's other pages (chat, members, divisions, settings) sit outside
 * this group, reached from the member's menu, with a plain header of their
 * own. Route groups do not change the URL: the Pets tab is
 * /rescue-forces/[id].
 */

import { notFound } from 'next/navigation';
import { getForcePage } from '@/app/lib/forcePage';
import ForceShell from './ForceShell';

export const dynamic = 'force-dynamic';

export default async function ForceTabsLayout({ children, params }) {
  const { id } = await params;
  const data = await getForcePage(id);
  if (!data) notFound();
  return <ForceShell data={data}>{children}</ForceShell>;
}
