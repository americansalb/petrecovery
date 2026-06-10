'use client';

/**
 * ActivityLog - what has actually happened, newest first
 *
 * A derived feed: sightings, completed search legs, and (on command)
 * coordinator notes. Items arrive normalized; this component only
 * renders. Compact mode trims to the latest few for the sheet.
 */

import { Eye, Footprints, StickyNote, FileText } from 'lucide-react';
import { timeAgoShort } from '../../hooks/useMissionState';

const KIND_META = {
  sighting: { icon: Eye, ring: 'bg-flash-400/15 text-flash-300' },
  leg: { icon: Footprints, ring: 'bg-emerald-500/15 text-emerald-300' },
  note: { icon: StickyNote, ring: 'bg-sky-500/15 text-sky-300' },
  update: { icon: FileText, ring: 'bg-slate-600/30 text-slate-300' },
};

export function buildActivityItems({ sightings = [], completedLegs = [], notes = [] }) {
  const items = [];
  for (const s of sightings) {
    items.push({
      id: `sighting-${s.id}`,
      kind: 'sighting',
      at: s.sightedAt || s.createdAt,
      title: s.reporterName ? `${s.reporterName} reported a sighting` : 'Sighting reported',
      detail: s.address || s.description || null,
    });
  }
  for (const leg of completedLegs) {
    items.push({
      id: `leg-${leg.id}`,
      kind: 'leg',
      at: leg.endedAt || leg.startedAt,
      title: `${leg.userName || 'A searcher'} covered ground`,
      detail: null,
    });
  }
  for (const n of notes) {
    items.push({
      id: `note-${n.id}`,
      kind: n.isUpdate ? 'update' : 'note',
      at: n.createdAt,
      title: n.author?.firstName ? `${n.author.firstName} noted` : 'Note',
      detail: n.content,
    });
  }
  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

export default function ActivityLog({ items = [], now = Date.now(), limit, emptyText = 'Nothing yet. The first sighting changes everything.' }) {
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    return <p className="text-sm text-slate-500 py-3 text-center">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {shown.map((item) => {
        const meta = KIND_META[item.kind] || KIND_META.update;
        const Icon = meta.icon;
        return (
          <li key={item.id} className="flex items-start gap-2.5">
            <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.ring}`}>
              <Icon size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white leading-snug">
                {item.title}
                <span className="text-slate-500 text-xs ml-2">{timeAgoShort(item.at, now)}</span>
              </p>
              {item.detail && <p className="text-xs text-slate-400 truncate">{item.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
