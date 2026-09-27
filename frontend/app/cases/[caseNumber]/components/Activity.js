'use client';

/**
 * "What happened" on the pet's page: sightings, the owner's updates, needs
 * members finished, and the day the pet went missing (or was found, or came
 * home), newest first. Three at first, then "Show all".
 */

import { useState } from 'react';
import { Eye, MessageSquare, Camera, Check, Megaphone, MapPin } from 'lucide-react';
import { timeAgo, shortDate } from '@/app/lib/caseLabels';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';

const SHOWN_AT_FIRST = 3;

// Sighting.certaintyLevel, 1 to 5, as the reporter chose it.
const CERTAINTY = { 5: 'Very sure', 4: 'Likely', 3: 'Possible', 2: 'Not sure', 1: 'Unlikely' };

function photoCount(photoUrls) {
  try {
    const list = typeof photoUrls === 'string' ? JSON.parse(photoUrls || '[]') : photoUrls;
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** The first part of an address ("Zilker Park"), never a pair of coordinates. */
function nearWhat(address) {
  if (!address || looksLikeCoordinates(address)) return '';
  // Reporters often type "Near the park" themselves; don't print "near Near".
  return address.split(',')[0].trim().replace(/^near\s+/i, '');
}

function Sighting({ s }) {
  const where = nearWhat(s.address);
  const photos = photoCount(s.photoUrls);
  const details = [timeAgo(s.sightedAt), s.reporterName && `reported by ${s.reporterName}`, CERTAINTY[s.certaintyLevel]]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex gap-3">
      {/* Orange, the sighting color of app/lib/petColors.js, as on the map above. */}
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
        <Eye size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-midnight-900">Sighting{where ? ` near ${where}` : ''}</p>
        <p className="text-sm text-midnight-500">{details}</p>
        {s.description && <p className="mt-1 whitespace-pre-line break-words text-midnight-700">{s.description}</p>}
        {photos > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-midnight-500">
            <Camera size={14} aria-hidden="true" />
            {photos === 1 ? 'Photo attached' : `${photos} photos attached`}
          </p>
        )}
      </div>
    </div>
  );
}

function Update({ u }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-600">
        <MessageSquare size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-midnight-900">Update</p>
        <p className="text-sm text-midnight-500">{timeAgo(u.createdAt)}</p>
        {u.content && <p className="mt-1 whitespace-pre-line break-words text-midnight-700">{u.content}</p>}
      </div>
    </div>
  );
}

/** A line with an icon: a need done, or where the story starts or ends. */
function Event({ icon: Icon, tint, text, at }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-midnight-900">{text}</p>
        <p className="text-sm text-midnight-500">{timeAgo(at) || shortDate(at)}</p>
      </div>
    </div>
  );
}

// The pet colors of app/lib/petColors.js; green comes with a check mark.
const MARK = {
  lost: { icon: Megaphone, tint: 'bg-red-100 text-red-700' },
  found: { icon: MapPin, tint: 'bg-sky-100 text-sky-700' },
  home: { icon: Check, tint: 'bg-emerald-100 text-emerald-700' },
};

/**
 * `done` is the force's finished needs for this pet ({ id, text, at });
 * `marks` the story's ends ({ kind: 'lost' | 'found' | 'home', text, at }).
 */
export default function Activity({ sightings = [], updates = [], done = [], marks = [], emptyText }) {
  const [showAll, setShowAll] = useState(false);

  const items = [
    ...sightings.map((s) => ({ key: `s-${s.id}`, at: s.sightedAt, node: <Sighting s={s} /> })),
    ...updates.map((u) => ({ key: `u-${u.id}`, at: u.createdAt, node: <Update u={u} /> })),
    ...done.map((d) => ({
      key: `d-${d.id}`,
      at: d.at,
      node: <Event icon={Check} tint="bg-midnight-100 text-midnight-700" text={d.text} at={d.at} />,
    })),
    ...marks
      .filter((m) => m.at)
      .map((m) => ({ key: `m-${m.kind}`, at: m.at, node: <Event {...MARK[m.kind]} text={m.text} at={m.at} /> })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const shown = showAll ? items : items.slice(0, SHOWN_AT_FIRST);

  return (
    <section aria-labelledby="activity-heading" className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6">
      <h2 id="activity-heading" className="text-lg font-semibold text-midnight-900">
        What happened
      </h2>

      {items.length === 0 ? (
        <p className="mt-2 text-midnight-500">{emptyText}</p>
      ) : (
        <ol className="mt-4 space-y-5">
          {shown.map((item) => (
            <li key={item.key}>{item.node}</li>
          ))}
        </ol>
      )}

      {items.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 text-sm font-semibold text-midnight-700 underline-offset-4 hover:text-midnight-900 hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
