'use client';

/**
 * SheetTeam - the full detent: the humans
 *
 * Presence, chat, and the shelter call list. On the bridge instrument
 * the honest app card rides along.
 */

import PresenceStrip from '../regions/PresenceStrip';
import ChatModule from '../regions/ChatModule';
import ShelterList from '../regions/ShelterList';
import WebGpsHint from '../regions/WebGpsHint';

export default function SheetTeam({
  team,
  activeParticipants,
  chat,
  pois,
  poisLoading,
  missionId,
  showGpsHint = false,
  onTrackAnyway,
}) {
  return (
    <div className="space-y-4 pt-2">
      {showGpsHint && <WebGpsHint missionId={missionId} onTrackAnyway={onTrackAnyway} />}

      <div>
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Search party</h3>
        <PresenceStrip team={team} activeParticipants={activeParticipants} />
      </div>

      <div className="h-[320px] flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <ChatModule {...chat} />
      </div>

      <div id="sheet-shelters">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Call the shelters</h3>
        <ShelterList pois={pois} missionId={missionId} isLoading={poisLoading} />
      </div>
    </div>
  );
}
