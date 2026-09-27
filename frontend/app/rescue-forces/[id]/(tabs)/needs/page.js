/**
 * A Rescue Force's page, Needs tab: what its searches need done right now,
 * each with its pet, and what members finished lately
 * (app/lib/forceNeeds.js). Members take a need, give it back, or mark it
 * done here; anyone else is asked to join first.
 *
 * Everyone sees what is needed, which is the point of the tab for someone
 * deciding whether to join. The notes under a need (places, times) are
 * for members.
 */

import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getForcePage } from '@/app/lib/forcePage';
import { listNeeds, recentNeedActivity } from '@/app/lib/forceNeeds';
import { timeAgo } from '@/app/lib/caseLabels';
import { forceMetadata } from '../forceMetadata';
import NeedsTab from './NeedsTab';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return forceMetadata(id, { tab: 'needs' });
}

export default async function ForceNeedsPage({ params }) {
  const { id } = await params;
  const data = await getForcePage(id);
  if (!data) notFound();
  const member = data.viewer.isMember || data.viewer.isAdmin;
  const session = await getServerSession(authOptions);
  const userId = data.viewer.isMember ? session?.user?.id || null : null;

  const [needs, recent] = await Promise.all([
    listNeeds(id, { userId, member }),
    recentNeedActivity(id, { userId: session?.user?.id || null }),
  ]);
  // Times as words here, so the page and the browser agree on them.
  return (
    <NeedsTab
      needs={needs.map((n) => ({ ...n, asked: `Asked ${timeAgo(n.askedAt)}` }))}
      recent={recent.map((a) => ({ ...a, when: timeAgo(a.at) }))}
    />
  );
}
