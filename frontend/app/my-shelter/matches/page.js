/**
 * Matches: stray-vs-lost review. The owner is only ever contacted
 * after a human here confirms; this page is that human's desk.
 */

import { requirePortal } from '../lib';
import StrayMatches from '@/app/shelter/StrayMatches';
import { Radar } from 'lucide-react';

export const dynamic = 'force-dynamic';

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-midnight-200 bg-white p-10 text-center">
      <Radar className="w-10 h-10 text-midnight-300 mx-auto mb-3" />
      <h3 className="font-bold text-midnight-900 mb-1">No matches waiting</h3>
      <p className="text-midnight-600 max-w-md mx-auto">
        When a stray you log resembles a local lost-pet report (or a new report
        resembles one of your animals), it appears here with the photos side by side.
        You&rsquo;ll also get a notification.
      </p>
    </div>
  );
}

export default async function PortalMatches() {
  await requirePortal();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-midnight-900">Matches</h1>
        <p className="text-midnight-500">
          Strays you log are checked against local lost-pet reports, photos included.
          Nothing reaches an owner until you confirm.
        </p>
      </div>
      <StrayMatches hideHeading emptyState={<EmptyState />} />
    </div>
  );
}
