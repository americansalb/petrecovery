'use client';

/**
 * The Pets tab: Lost, Found and Reunited as filters (reunited off until
 * asked for, the same filters as the map), then one row per pet with its
 * photo, how long it has been lost or found, where, and how many things its
 * search needs. On a computer the map sits beside the list and stays in
 * view while the list scrolls.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import PetStatusDot from '@/app/components/PetStatusDot';
import { PET_TEXT } from '@/app/lib/petColors';
import { useForce, ForceMapSlot } from './ForceShell';

const CHIPS = [
  { key: 'lost', label: 'Lost', on: 'border-red-300 bg-red-50' },
  { key: 'found', label: 'Found', on: 'border-sky-300 bg-sky-50' },
  { key: 'home', label: 'Reunited', on: 'border-emerald-300 bg-emerald-50' },
];

function PetPhoto({ pet }) {
  const [failed, setFailed] = useState(false);
  const box = 'h-[76px] w-[76px] shrink-0 rounded-[14px]';
  if (!pet.photo || failed) {
    return (
      <span className={`${box} flex items-center justify-center bg-midnight-100 text-midnight-400`} aria-hidden="true">
        <SpeciesIcon species={String(pet.species || '').toUpperCase()} size={30} />
      </span>
    );
  }
  return (
    // Report photos come from the CDN and uploads; next/image is not set up for them.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pet.photo} alt="" loading="lazy" onError={() => setFailed(true)} className={`${box} bg-midnight-100 object-cover`} />
  );
}

function PetRow({ pet }) {
  return (
    <li>
      <Link
        href={`/cases/${encodeURIComponent(pet.caseNumber)}`}
        className="flex items-center gap-3.5 rounded-2xl border-2 border-midnight-200 bg-white p-3 transition hover:border-midnight-300 hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
      >
        <PetPhoto pet={pet} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[19px] font-extrabold leading-tight text-midnight-900">{pet.name}</span>
          <span className={`flex items-center gap-1.5 text-sm font-bold ${PET_TEXT[pet.status] || PET_TEXT.closed}`}>
            <PetStatusDot status={pet.status} />
            {pet.when}
          </span>
          {pet.near && <span className="truncate text-sm text-midnight-600">{pet.near}</span>}
          {pet.needs > 0 && pet.status !== 'home' && (
            <span className="mt-0.5 self-start rounded-full bg-flash-200 px-2.5 py-0.5 text-[13px] font-extrabold text-flash-900">
              {pet.needs === 1 ? '1 thing needed' : `${pet.needs} things needed`}
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-midnight-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function PetsTab({ justCreated }) {
  const { force, pets, shown, toggle } = useForce();
  const counts = { lost: 0, found: 0, home: 0 };
  pets.forEach((p) => {
    if (counts[p.status] != null) counts[p.status] += 1;
  });
  const list = pets.filter((p) => shown.has(p.status));

  return (
    <div className="lg:grid lg:min-h-[calc(100vh-115px)] lg:grid-cols-[460px_minmax(0,1fr)]">
      <section aria-label="Pets" className="px-4 pb-24 pt-3.5 lg:border-r lg:border-midnight-200 lg:pb-8">
        {justCreated && (
          <p role="status" className="mb-4 rounded-2xl bg-flash-50 px-4 py-3 text-midnight-900 ring-1 ring-flash-300">
            Your Rescue Force is set up. Share this page with neighbors so they can join.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => {
            const on = shown.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.key)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-bold transition ${
                  on ? `${c.on} text-midnight-900` : 'border-midnight-200 bg-white text-midnight-600 hover:border-midnight-300'
                }`}
              >
                <PetStatusDot status={c.key} />
                {c.label} ({counts[c.key]})
              </button>
            );
          })}
        </div>

        {pets.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-midnight-50 px-5 py-6 text-midnight-600 ring-1 ring-midnight-200">
            No pets are reported lost or found in this area right now.
          </p>
        ) : list.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-midnight-50 px-5 py-6 text-midnight-600 ring-1 ring-midnight-200">
            Nothing to show. Tap Lost or Found above.
          </p>
        ) : (
          <ul className="mt-3.5 space-y-2.5">
            {list.map((pet) => (
              <PetRow key={pet.id} pet={pet} />
            ))}
          </ul>
        )}

        {/* An owner can land here first (a search, a flyer, a neighbor's
            link). A report inside the force's area is assigned to it. */}
        <p className="mt-5 text-center text-[15px] text-midnight-600">
          <Link
            href="/report/new"
            className="inline-flex items-center gap-1 font-semibold text-midnight-800 underline-offset-4 hover:underline"
          >
            {force.city ? `Pet missing near ${force.city}? Report it` : 'Pet missing? Report it'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </section>

      {/* Computer: the map beside the list, held in view under the tabs. */}
      <div className="hidden lg:block">
        <div className="relative isolate lg:sticky lg:top-[115px] lg:h-[calc(100vh-115px)]">
          <ForceMapSlot where="side" />
          <p className="pointer-events-none absolute bottom-4 left-4 z-[450] flex items-center gap-3 rounded-[14px] bg-white px-4 py-3 text-sm text-midnight-700 shadow-[0_2px_10px_rgba(15,23,42,0.2)]">
            <span className="h-4 w-6 shrink-0 rounded border-2 border-midnight-900 bg-flash-400/30 ring-1 ring-flash-400" aria-hidden="true" />
            Inside the yellow line: {force.name}&apos;s area.
          </p>
        </div>
      </div>
    </div>
  );
}
