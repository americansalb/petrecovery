'use client';

/**
 * One pet on the Lost & Found board.
 *
 * A row on a phone (photo left, facts right) so a screen holds several
 * pets, and a photo card from the small breakpoint up. The whole card is
 * the link to the pet's page. What it says comes from app/lib/caseLabels.js,
 * the same wording the map pins use. A photo link that no longer loads falls
 * back to the no-photo picture instead of an empty grey box.
 */

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Eye } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { caseStatus, caseTitle, caseDescriptor, casePlace, caseTimeline } from '@/app/lib/caseLabels';

export const STATUS_DOT = {
  lost: 'bg-red-500',
  found: 'bg-sky-500',
  home: 'bg-emerald-500',
  closed: 'bg-midnight-400',
};

export default function PetCard({ c }) {
  const status = caseStatus(c);
  const sightings = c.sightingCount || 0;
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(c.petPhotoUrl) && !photoFailed;

  return (
    <Link
      href={`/cases/${encodeURIComponent(c.caseNumber)}`}
      className="group flex gap-4 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-midnight-200 transition hover:shadow-lg hover:ring-midnight-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 sm:flex-col sm:gap-0 sm:p-0"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-midnight-100 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.petPhotoUrl}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-midnight-400">
            <SpeciesIcon species={String(c.petSpecies || '').toUpperCase()} size={34} />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-midnight-900 shadow-sm">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status.key]}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <div className="min-w-0 flex-1 py-0.5 sm:p-4">
        <h3 className="truncate text-lg font-semibold text-midnight-900">{caseTitle(c)}</h3>
        <p className="truncate text-sm text-midnight-500">{caseDescriptor(c)}</p>
        <ul className="mt-2 space-y-1 text-sm text-midnight-600">
          <li className="flex min-w-0 items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-midnight-400" aria-hidden="true" />
            <span className="truncate">{casePlace(c)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Clock size={14} className="shrink-0 text-midnight-400" aria-hidden="true" />
            {caseTimeline(c)}
          </li>
          {sightings > 0 && status.key !== 'home' && (
            <li className="flex items-center gap-1.5 font-medium text-flash-700">
              <Eye size={14} className="shrink-0" aria-hidden="true" />
              {sightings} {sightings === 1 ? 'sighting' : 'sightings'}
            </li>
          )}
        </ul>
      </div>
    </Link>
  );
}
