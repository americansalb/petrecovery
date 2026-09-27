'use client';

/**
 * The Needs tab: what the force's searches need done now, most urgent
 * first, each with its pet's photo, when it was asked, and how many people
 * are on it. A member opens the pet's search map to take one; a visitor is
 * asked to join first.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Shield, UserPlus } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { useForce } from '../ForceShell';

function peopleText(n) {
  if (n === 0) return 'Nobody on it yet';
  return n === 1 ? '1 person on it' : `${n} people on it`;
}

function PetFace({ pet }) {
  const [failed, setFailed] = useState(false);
  const box = 'h-14 w-14 shrink-0 rounded-xl';
  if (!pet) {
    return (
      <span className={`${box} flex items-center justify-center bg-midnight-900 text-flash-400`} aria-hidden="true">
        <Shield className="h-6 w-6" />
      </span>
    );
  }
  if (!pet.photo || failed) {
    return (
      <span className={`${box} flex items-center justify-center bg-midnight-100 text-midnight-400`} aria-hidden="true">
        <SpeciesIcon species={String(pet.species || '').toUpperCase()} size={24} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pet.photo} alt="" loading="lazy" onError={() => setFailed(true)} className={`${box} bg-midnight-100 object-cover`} />
  );
}

export default function NeedsTab({ needs }) {
  const { force, viewer, join, joining } = useForce();
  const member = viewer.isMember || viewer.isAdmin;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 lg:pb-10">
      <h2 className="text-xl font-extrabold tracking-tight text-midnight-900">Help needed right now</h2>
      <p className="mt-1 text-[15px] text-midnight-600">
        {member
          ? "Owners and leaders asked for these. To take one, open the pet's search map."
          : `Owners and leaders asked for these. Join ${force.name} to take one on.`}
      </p>

      {!member && (
        <button
          type="button"
          onClick={join}
          disabled={joining}
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-flash-400 text-base font-extrabold text-midnight-900 shadow-[0_2px_6px_rgba(202,138,4,0.28)] disabled:opacity-60 sm:w-auto sm:px-7"
        >
          {joining ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
          Join to help
        </button>
      )}

      {needs.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-midnight-50 px-5 py-6 text-midnight-600 ring-1 ring-midnight-200">
          Nothing is needed right now.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {needs.map((n) => {
            const body = (
              <>
                <PetFace pet={n.pet} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-bold leading-snug text-midnight-900">{n.title}</span>
                  <span className="text-sm text-midnight-600">
                    {[n.pet ? n.pet.name : 'The whole force', n.asked, peopleText(n.people)].join(' · ')}
                  </span>
                  {n.byOwner && (
                    <span className="mt-0.5 self-start rounded-full bg-midnight-100 px-2 py-0.5 text-xs font-bold text-midnight-700">
                      Asked by the owner
                    </span>
                  )}
                  {n.details && <span className="mt-1 whitespace-pre-line text-sm text-midnight-700">{n.details}</span>}
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {member && n.pet ? (
                  <Link
                    href={`/mission-control?mission=${encodeURIComponent(n.pet.caseNumber)}`}
                    className="flex items-start gap-3.5 rounded-2xl border-2 border-midnight-200 bg-white p-3.5 transition hover:border-midnight-300"
                  >
                    {body}
                    <ChevronRight className="mt-4 h-5 w-5 shrink-0 text-midnight-400" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3.5 rounded-2xl border-2 border-midnight-200 bg-white p-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
