'use client';

/**
 * FlyerStrip - the flyer so far, as a small card at the foot of a wizard
 * screen on a phone: a thumbnail of the flyer and one line of what it
 * says. It fills the space under a short question with the thing the
 * answers are building, and it stays quiet (white, grey) so the question
 * keeps the eye.
 */

import FlyerPreview from './FlyerPreview';

const WORDS = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit' };

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export default function FlyerStrip({ flyer, label = 'Your flyer so far' }) {
  if (!flyer) return null;
  const word = WORDS[String(flyer.species || 'OTHER').toUpperCase()] || 'pet';
  const title = flyer.petName ? `${flyer.petName}, a ${word}` : `A ${word}`;
  // "Last seen today, Calle Vizcarra." / "Found just now, Lajas." The time
  // word is a label like "Today", so only its first letter drops; the place
  // is a name and keeps its case.
  const seen = [lowerFirst(flyer.when), flyer.where].filter(Boolean).join(', ');
  const seenLine = seen ? `${flyer.variant === 'found' ? 'Found' : 'Last seen'} ${seen}.` : '';
  const line = [seenLine, flyer.lookFor].filter(Boolean).join(' ');
  return (
    <div className="flex items-center gap-3 rounded-xl border border-midnight-200 bg-white px-3 py-2.5">
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded">
        <FlyerPreview {...flyer} width={48} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-[18px] text-midnight-900">{label}</p>
        <p className="line-clamp-2 text-xs leading-4 text-midnight-500">
          {title}.{line ? ` ${line}` : ' The answers fill it in.'}
        </p>
      </div>
    </div>
  );
}
