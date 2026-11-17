'use client';

/**
 * "If you see {name}": what a finder should do, from the report's
 * questionnaire (app/lib/caseDetails.js finderGuide, served by the public
 * case API). The approach line first, in large type, because it is the
 * one thing a stranger has to get right; then the health line, the
 * reward, and the facts that help someone be sure it is the right pet.
 *
 * On a phone (IfYouSee) only the approach line shows; "More about {name}"
 * opens the rest, with the reporter's description and the pet's details.
 */

import { useId, useState } from 'react';
import { AlertTriangle, ChevronDown, Eye, Footprints, Info, MapPin, PawPrint, Volume2 } from 'lucide-react';

/** The guide's facts as rows: what to look for, what the pet comes to, where it may head. */
function guideRows(guide, name) {
  if (!guide) return [];
  return [
    guide.lookFor ? { icon: Eye, label: 'Look for', text: guide.lookFor } : null,
    guide.facts?.length ? { icon: Info, label: 'Facts', text: guide.facts.join(', ') } : null,
    guide.lure ? { icon: Volume2, label: `${name} comes to`, text: guide.lure.replace(/^Comes to /, '') } : null,
    guide.places ? { icon: MapPin, label: 'May head for', text: guide.places.replace(/^May head for /, '') } : null,
    guide.howOut ? { icon: Footprints, label: 'How it happened', text: `${guide.howOut}${guide.withOtherPet ? ', with another pet' : ''}` } : null,
    guide.notes ? { icon: Info, label: 'From the family', text: guide.notes } : null,
  ].filter(Boolean);
}

function rewardWords(hasReward, rewardAmount) {
  if (!hasReward) return '';
  return rewardAmount ? `$${Number(rewardAmount).toLocaleString('en-US')} reward` : 'Reward offered';
}

export default function FinderGuide({ name, guide, hasReward, rewardAmount }) {
  if (!guide || !guide.approach) return null;
  const rows = guideRows(guide, name);
  const reward = rewardWords(hasReward, rewardAmount);

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

/**
 * The phone's version: "If you see {name}", the owner's approach line and,
 * where there is one, the health line (a medical need changes how fast a
 * finder should call, so it is never folded away), then "More about {name}"
 * for the reward, the description, the details and the rest of the guide. With no approach
 * line (a found pet, a pet home) it is "More about {name}" alone, and
 * nothing at all when there is nothing more to say.
 */
export function IfYouSee({ name, Name, guide, hasReward, rewardAmount, description, looks, postedBy }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const approach = guide?.approach || '';
  const rows = guideRows(guide, name);
  const reward = rewardWords(hasReward, rewardAmount);
  const more = Boolean(reward || description || looks || rows.length || guide?.microchipped || postedBy);
  if (!approach && !more && !guide?.health) return null;

  return (
    <section
      aria-label={approach ? `If you see ${name}` : `More about ${name}`}
      className={approach ? 'rounded-2xl border-2 border-midnight-900 bg-flash-50 px-4 pb-2 pt-4' : 'rounded-2xl bg-white px-4 py-1 ring-1 ring-midnight-200'}
    >
      {approach && (
        <>
          <h2 className="text-lg font-bold text-midnight-900">If you see {name}</h2>
          <p className="mt-1 text-base font-semibold leading-snug text-midnight-900">{approach}</p>
        </>
      )}
      {/* A medical need is in sight, not folded under "More about": it changes how fast a finder should call. */}
      {guide?.health && (
        <p className={`flex items-start gap-2 text-base font-semibold text-red-700 ${approach ? 'mt-2' : 'py-2'}`}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{guide.health}</span>
        </p>
      )}
      {more && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className={`flex min-h-[48px] w-full items-center justify-between gap-3 text-left text-base font-semibold text-midnight-800 ${approach ? 'mt-1 border-t border-midnight-900/10' : ''}`}
        >
          <span className="min-w-0 break-words">More about {name}</span>
          <ChevronDown size={20} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
      <div id={bodyId} hidden={!open} className="space-y-3 pb-3 text-base text-midnight-800">
        {reward && <p className="font-semibold">{reward}, paid once {name} is home.</p>}
        {description && <p className="whitespace-pre-line break-words leading-relaxed">{description}</p>}
        {(looks || rows.length > 0) && (
          <dl className="space-y-2">
            {looks && (
              <div className="flex gap-2">
                <PawPrint size={18} className="mt-0.5 shrink-0 text-midnight-500" aria-hidden="true" />
                <div className="min-w-0 break-words">
                  <dt className="inline font-semibold">Looks like: </dt>
                  <dd className="inline">{looks}</dd>
                </div>
              </div>
            )}
            {rows.map((r) => (
              <div key={r.label} className="flex gap-2">
                <r.icon size={18} className="mt-0.5 shrink-0 text-midnight-500" aria-hidden="true" />
                <div className="min-w-0 break-words">
                  <dt className="inline font-semibold">{r.label}: </dt>
                  <dd className="inline">{r.text}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
        {guide?.microchipped && <p className="text-sm text-midnight-600">{Name} is microchipped. Any vet or shelter can scan it, usually for free.</p>}
        {postedBy && <p className="text-sm text-midnight-600">{postedBy}</p>}
      </div>
    </section>
  );
}
