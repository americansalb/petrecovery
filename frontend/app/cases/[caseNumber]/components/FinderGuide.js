'use client';

/**
 * "If you see {name}": what a finder should do, from the report's
 * questionnaire (app/lib/caseDetails.js finderGuide, served by the public
 * case API). The approach line first, in large type, because it is the
 * one thing a stranger has to get right; then the health line, the
 * reward, and the facts that help someone be sure it is the right pet.
 */

import { AlertTriangle, Eye, Footprints, Info, MapPin, Volume2 } from 'lucide-react';

export default function FinderGuide({ name, guide, hasReward, rewardAmount }) {
  if (!guide || !guide.approach) return null;
  const rows = [
    guide.lookFor ? { icon: Eye, label: 'Look for', text: guide.lookFor } : null,
    guide.facts?.length ? { icon: Info, label: 'Facts', text: guide.facts.join(', ') } : null,
    guide.lure ? { icon: Volume2, label: `${name} comes to`, text: guide.lure.replace(/^Comes to /, '') } : null,
    guide.places ? { icon: MapPin, label: 'May head for', text: guide.places.replace(/^May head for /, '') } : null,
    guide.howOut ? { icon: Footprints, label: 'How it happened', text: `${guide.howOut}${guide.withOtherPet ? ', with another pet' : ''}` } : null,
    guide.notes ? { icon: Info, label: 'From the family', text: guide.notes } : null,
  ].filter(Boolean);
  const reward = hasReward ? (rewardAmount ? `$${Number(rewardAmount).toLocaleString('en-US')} reward` : 'Reward offered') : '';

  return (
    <section aria-labelledby="finder-guide-heading" className="mt-6 rounded-2xl border-2 border-midnight-900 bg-flash-50 p-4">
      <h2 id="finder-guide-heading" className="text-xs font-extrabold uppercase tracking-[0.14em] text-midnight-600">
        If you see {name}
      </h2>
      <p className="mt-1.5 text-lg font-bold leading-snug text-midnight-900">{guide.approach}</p>
      {guide.health && (
        <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{guide.health}</span>
        </p>
      )}
      {reward && (
        <p className="mt-2 text-sm font-semibold text-midnight-800">
          {reward}, paid once {name} is home.
        </p>
      )}
      {rows.length > 0 && (
        <dl className="mt-3 space-y-1.5 text-sm text-midnight-800">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-2">
              <r.icon size={16} className="mt-0.5 shrink-0 text-midnight-500" aria-hidden="true" />
              <div className="min-w-0 break-words">
                <dt className="inline font-semibold">{r.label}: </dt>
                <dd className="inline">{r.text}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
      {guide.microchipped && <p className="mt-2 text-xs text-midnight-500">{name} is microchipped. Any vet or shelter can scan it, usually for free.</p>}
    </section>
  );
}
