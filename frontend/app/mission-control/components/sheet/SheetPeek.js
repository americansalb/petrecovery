'use client';

/**
 * SheetPeek - always visible: the vitals and the ONE thing to do
 *
 * While a GPS leg is live (field instrument), the peek becomes the
 * LiveSearchHUD. Otherwise: vitals row + PrimaryCTA.
 */

import MissionVitals from '../regions/MissionVitals';
import PrimaryCTA from '../regions/PrimaryCTA';
import LiveSearchHUD from '../live/LiveSearchHUD';

export default function SheetPeek({
  isSearching,
  hud,
  vitals,
  cta,
}) {
  if (isSearching) {
    return <LiveSearchHUD {...hud} />;
  }
  return (
    <div className="space-y-3">
      <MissionVitals {...vitals} />
      <PrimaryCTA {...cta} />
    </div>
  );
}
