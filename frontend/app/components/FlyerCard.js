'use client';

/**
 * FlyerCard - the design language's atom
 *
 * A lost-pet flyer pinned slightly crooked to the board: red pushpin,
 * full-bleed photo, rubber-stamped status, the name in poster
 * capitals, tear-off tabs with one already taken. The stamp reads the
 * case itself (status / reportType), so the same flyer is honest on
 * any surface: the corkboard, the homepage, a force page.
 */

import Link from 'next/link';
import { MapPin, Phone } from 'lucide-react';
import { looksLikeCoordinates, PIN_ONLY_LABEL } from '@/app/lib/maps/reverseLabel';

function speciesEmoji(species) {
  switch ((species || '').toUpperCase()) {
    case 'DOG': return '🐕';
    case 'CAT': return '🐈';
    case 'BIRD': return '🦜';
    case 'RABBIT': return '🐇';
    default: return '🐾';
  }
}

// Construction-paper tint for photo-less flyers, keyed by species, so a
// row of them reads as different flyers instead of one grey wall.
function speciesTint(species) {
  switch ((species || '').toUpperCase()) {
    case 'DOG': return 'bg-amber-50';
    case 'CAT': return 'bg-orange-50';
    case 'BIRD': return 'bg-sky-50';
    case 'RABBIT': return 'bg-rose-50';
    default: return 'bg-flash-50';
  }
}

// "Unknown" is a database value, not something to print on a poster.
function known(value) {
  return value && !/^unknown/i.test(value) ? value : null;
}

function stampFor(c) {
  const reunited = c.status === 'REUNITED' || c.resolution === 'REUNITED';
  const found = c.reportType === 'FOUND';

  if (reunited) {
    let text = 'HOME';
    if (c.lastSeenAt && c.resolvedAt) {
      const days = Math.max(1, Math.round((new Date(c.resolvedAt) - new Date(c.lastSeenAt)) / 86400000));
      text = `HOME · ${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
    }
    return { text, classes: 'border-emerald-500 text-emerald-600' };
  }

  const ref = c.lastSeenAt || c.createdAt;
  let span = '';
  if (ref) {
    const hours = Math.floor((Date.now() - new Date(ref).getTime()) / 3600000);
    const days = Math.floor(hours / 24);
    span = hours < 1 ? ' NOW' : hours < 24 ? ` ${hours}H` : ` ${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
  }
  if (found) return { text: `FOUND${span}`, classes: 'border-sky-500 text-sky-600' };
  return {
    text: `LOST${span}`,
    classes: c.isUrgent ? 'border-red-600 text-red-600' : 'border-midnight-900 text-midnight-900',
  };
}

export default function FlyerCard({ c, index = 0 }) {
  const reunited = c.status === 'REUNITED' || c.resolution === 'REUNITED';
  const stamp = stampFor(c);
  const tilt = ['-rotate-[0.8deg]', 'rotate-[0.6deg]', '-rotate-[0.4deg]', 'rotate-[0.9deg]'][index % 4];
  const species = known(c.petSpecies);
  const headline = known(c.petName) || (species ? species.toLowerCase() : 'pet');
  const traits = [known(c.petBreed), known(c.petColor)].filter(Boolean).join(' · ')
    || (known(c.petName) && species ? species.toLowerCase() : '');
  const tabText = c.reportType === 'FOUND' ? 'YOURS?' : 'SEEN ME?';

  return (
    <Link
      href={`/cases/${c.caseNumber}`}
      className={`group relative block bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] hover:shadow-[0_18px_44px_rgba(15,23,42,0.3)] transition-all duration-200 ${tilt} hover:rotate-0 hover:-translate-y-1`}
    >
      {/* Pin */}
      <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_-1px_-2px_3px_rgba(0,0,0,0.35)] z-10" aria-hidden="true" />

      {/* Photo */}
      <div className="relative h-48 bg-midnight-100 overflow-hidden border-b-4 border-midnight-950">
        {c.petPhotoUrl ? (
          <img src={c.petPhotoUrl} alt={c.petName} loading="lazy" className={`w-full h-full object-cover ${reunited ? '' : 'group-hover:scale-[1.03] transition-transform duration-300'}`} />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 ${speciesTint(c.petSpecies)}`}>
            <span className="text-5xl" aria-hidden="true">{speciesEmoji(c.petSpecies)}</span>
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-midnight-400">No photo yet</span>
          </div>
        )}
        {/* Rubber stamp */}
        <span className={`absolute top-3 right-3 px-2.5 py-1 border-[3px] ${stamp.classes} bg-white/85 backdrop-blur-[2px] font-black text-xs tracking-[0.15em] uppercase -rotate-6`}>
          {stamp.text}
        </span>
        {c.sightingCount > 0 && !reunited && (
          <span className="absolute bottom-2.5 left-3 px-2 py-0.5 bg-midnight-950/85 text-flash-400 text-[10px] font-black tracking-widest uppercase">
            {c.sightingCount} sighting{c.sightingCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Poster body */}
      <div className="px-4 pt-3 pb-2 text-center">
        <h3 className="font-black uppercase tracking-tight text-2xl leading-none text-midnight-950 truncate">
          {headline}
        </h3>
        {traits && (
          <p className="text-[11px] font-semibold text-midnight-500 mt-1 truncate uppercase tracking-wide">
            {traits}
          </p>
        )}
        <p className="flex items-center justify-center gap-1 text-xs text-midnight-600 mt-1.5 truncate">
          <MapPin size={11} className="text-midnight-400 shrink-0" />
          {c.city && c.city !== 'Unknown'
            ? `${c.city}, ${c.state}`
            : c.lastSeenAddress && !looksLikeCoordinates(c.lastSeenAddress)
              ? c.lastSeenAddress
              : PIN_ONLY_LABEL}
        </p>
      </div>

      {/* Tear-off tabs */}
      <div className="flex border-t-2 border-dashed border-midnight-300 px-2 pb-0">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`flex-1 text-center py-1.5 text-[8px] font-bold text-midnight-400 border-l border-dashed border-midnight-200 first:border-l-0 ${i % 2 ? 'rotate-1' : '-rotate-1'} ${i === 3 && !reunited ? 'opacity-0' : ''}`}
          >
            <Phone size={8} className="inline mr-0.5 -mt-px" />
            {tabText}
          </span>
        ))}
      </div>
    </Link>
  );
}
