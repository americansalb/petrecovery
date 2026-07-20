'use client';

/**
 * SheetPeek - always visible: the situation, the vitals, the ONE thing
 *
 * While a GPS leg is live (field instrument) the peek becomes the
 * LiveSearchHUD. Otherwise: vitals row, then the ActionDock with its
 * situation line — a newcomer reads the peek top to bottom and knows
 * what is happening and what to do, without opening anything.
 */

import MissionVitals from '../regions/MissionVitals';
import ActionDock from '../ActionDock';
import LiveSearchHUD from '../live/LiveSearchHUD';

export default function SheetPeek({ isSearching, hud, vitals, dock }) {
  if (isSearching) {
    return <LiveSearchHUD {...hud} />;
  }
  return (
    <div className="space-y-3">
      <MissionVitals {...vitals} compact />
      <ActionDock {...dock} />
    </div>
  );
}
