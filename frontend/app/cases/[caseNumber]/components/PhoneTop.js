'use client';

/**
 * The first screen of a pet's page on a phone (under md), where most people
 * read it: from a link in a group chat, with one hand, for half a minute.
 *
 * PhoneTop, for anyone but the owner: the photo with the status on it, the
 * name, one line of what the pet looks like, where and when it was last
 * seen (the place from the report, never only the town), the newest
 * sighting as one line that jumps to the map, and the page's buttons.
 *
 * OwnerTop, for the owner: the photo small, how the search stands in plain
 * words (how long, who was alerted, sightings, who is out now), the newest
 * sighting, and the owner's one row of buttons. Their tools follow it.
 *
 * Computers and tablets keep the page's own header (../CasePageClient.js).
 */

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import PetStatusDot from '@/app/components/PetStatusDot';
import { placeOnly } from '@/app/lib/placeLabel';
import { timeAgo } from '@/app/lib/caseLabels';

// A sighting this recent pulses: someone may still be able to get there.
const HOT_MS = 60 * 60 * 1000;

/** The photo, 4:3, 200px tall (160 on a short screen), with the status on it. No photo: a short band. */
function Photo({ src, alt, species, badge, statusKey }) {
  const [failed, setFailed] = useState(false);
  const shown = src && !failed;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-midnight-100 ${shown ? 'h-[200px] [@media(max-height:700px)]:h-40' : 'h-32'}`}>
      {shown ? (
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label="Open the full-size photo" className="block h-full w-full">
          {/* The same photo, blurred, fills the sides of a screen wider than 4:3. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            fetchPriority="high"
            onError={() => setFailed(true)}
            className="relative mx-auto aspect-[4/3] h-full max-w-full object-cover"
          />
        </a>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-midnight-400">
          <SpeciesIcon species={String(species || '').toUpperCase()} size={48} />
          <span className="text-sm">No photo yet</span>
        </div>
      )}
      <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-midnight-900 shadow-sm">
        <PetStatusDot status={statusKey} />
        {badge}
      </span>
    </div>
  );
}

/** The owner's small photo. */
function Thumb({ src, alt, species }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-midnight-100">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-midnight-400">
          <SpeciesIcon species={String(species || '').toUpperCase()} size={32} />
        </span>
      )}
    </span>
  );
}

/** "Seen 9 minutes ago near Barton Springs Rd", one line, to the map. Never a house number. */
export function LatestSighting({ s, mapHref = '#pet-map' }) {
  const where = placeOnly(s.address);
  const hot = Date.now() - new Date(s.sightedAt).getTime() <= HOT_MS;
  const words = `Seen ${timeAgo(s.sightedAt)}${where ? ` near ${where}` : ''}`;
  return (
    <a
      href={mapHref}
      aria-label={`${words}. Show it on the map`}
      className="flex min-h-[48px] items-center gap-3 rounded-xl bg-flash-50 px-3 ring-1 ring-flash-300"
    >
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
        {hot && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flash-400 opacity-75" />}
        <span className="relative inline-flex h-3 w-3 rounded-full bg-flash-500" />
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-midnight-900">{words}</span>
      <MapPin size={18} className="shrink-0 text-midnight-600" aria-hidden="true" />
    </a>
  );
}

export default function PhoneTop({ c, title, alt, badge, statusKey, looks, lines, sighting, actionsId, children }) {
  return (
    <header className="pt-3">
      <Photo src={c.petPhotoUrl} alt={alt} species={c.petSpecies} badge={badge} statusKey={statusKey} />
      <h1 className="mt-3 break-words text-[28px] font-bold leading-tight tracking-tight text-midnight-900">{title}</h1>
      {looks && <p className="truncate text-base text-midnight-600">{looks}</p>}
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line.text} className="flex items-start gap-2 text-base leading-snug text-midnight-800">
            <line.icon size={18} className="mt-0.5 shrink-0 text-midnight-400" aria-hidden="true" />
            <span className="min-w-0 break-words">{line.text}</span>
          </li>
        ))}
      </ul>
      {sighting && (
        <div className="mt-3">
          <LatestSighting s={sighting} />
        </div>
      )}
      <div id={actionsId} className="mt-4">
        {children}
      </div>
    </header>
  );
}

/**
 * `facts` are the lines of the status block, each { icon, text }; `children`
 * the owner's row of buttons.
 */
export function OwnerTop({ c, title, alt, badge, statusKey, facts, sighting, actionsId, children }) {
  return (
    <header className="pt-3">
      <div className="flex items-center gap-3">
        <Thumb src={c.petPhotoUrl} alt={alt} species={c.petSpecies} />
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-700">
            <PetStatusDot status={statusKey} />
            {badge}
          </p>
          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-midnight-900">{title}</h1>
          <p className="text-sm text-midnight-500">Your report</p>
        </div>
      </div>
      <ul aria-label="How the search stands" className="mt-4 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
        {facts.map((f, i) =>
          f.held ? (
            // A line still loading: its place is kept, empty.
            <li key={`held-${i}`} aria-hidden="true" className="h-[22px]" />
          ) : (
            <li key={f.text} className="flex items-start gap-2.5 text-base leading-snug text-midnight-800">
              <f.icon size={18} className="mt-0.5 shrink-0 text-midnight-400" aria-hidden="true" />
              <span className="min-w-0 break-words">{f.text}</span>
            </li>
          )
        )}
      </ul>
      {sighting && (
        <div className="mt-3">
          <LatestSighting s={sighting} />
        </div>
      )}
      <div id={actionsId} className="mt-3">
        {children}
      </div>
    </header>
  );
}

/** A button in the owner's row: icon over words, so three fit across a phone. */
export const OWNER_TILE =
  'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center text-base font-semibold leading-tight transition';
