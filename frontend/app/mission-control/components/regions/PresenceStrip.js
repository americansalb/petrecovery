'use client';

/**
 * PresenceStrip - who is out there with you
 *
 * Team avatars with the actively searching ones ringed in emerald.
 * Searching alone at dusk feels different when you can see four other
 * faces on the line.
 */

export default function PresenceStrip({ team = [], activeParticipants = [] }) {
  const activeIds = new Set(activeParticipants.map((p) => p.userId));

  if (team.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        Nobody has joined yet. Share the alert to build the team.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-1 px-1">
      {team.slice(0, 12).map((member) => {
        const live = activeIds.has(member.userId);
        return (
          <div key={member.id || member.userId} className="flex flex-col items-center gap-1 shrink-0 w-14">
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                live
                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400'
                  : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
              }`}
            >
              {(member.firstName || member.name || '?')[0]}
            </span>
            <span className="text-[10px] text-slate-400 truncate w-full text-center">
              {member.firstName || member.name || 'Helper'}
            </span>
          </div>
        );
      })}
      {team.length > 12 && (
        <span className="text-xs text-slate-500 shrink-0">+{team.length - 12} more</span>
      )}
    </div>
  );
}
