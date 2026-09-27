'use client';

/**
 * "Other pets in {force}" at the foot of a pet's page: the force's other
 * pets still missing, then the latest ones home, in a row that scrolls
 * sideways on a phone. Each opens that pet's page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PET_COLOR, PET_TEXT } from '@/app/lib/petColors';

const LABEL = { lost: 'Lost', found: 'Found', home: 'Reunited', closed: 'Closed' };

function Face({ pet }) {
  const [failed, setFailed] = useState(false);
  const ring = { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${PET_COLOR[pet.status] || PET_COLOR.closed}` };
  return (
    <span className="relative m-1 block">
      {pet.photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pet.photo} alt="" loading="lazy" onError={() => setFailed(true)} className="h-20 w-20 rounded-2xl bg-midnight-100 object-cover" style={ring} />
      ) : (
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-midnight-100 text-midnight-400" style={ring}>
          <SpeciesIcon species={String(pet.species || '').toUpperCase()} size={30} />
        </span>
      )}
      {pet.status === 'home' && (
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white" aria-hidden="true">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

export default function OtherPets({ force, pets }) {
  if (!force || !pets?.length) return null;
  return (
    <section aria-labelledby="others-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="others-heading" className="text-lg font-semibold text-midnight-900">
          Other pets in {force.name}
        </h2>
        <Link
          href={`/rescue-forces/${force.id}`}
          className="inline min-h-0 min-w-0 shrink-0 text-sm font-semibold text-midnight-600 underline-offset-4 hover:text-midnight-900 hover:underline"
        >
          See all
        </Link>
      </div>
      <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {pets.map((p) => (
          <li key={p.caseNumber} className="w-24 shrink-0">
            <Link href={`/cases/${encodeURIComponent(p.caseNumber)}`} className="block rounded-2xl text-center">
              <Face pet={p} />
              <span className="mt-1.5 block truncate text-sm font-bold text-midnight-900">{p.name}</span>
              <span className={`block truncate text-xs font-semibold ${PET_TEXT[p.status] || PET_TEXT.closed}`}>
                {LABEL[p.status] || 'Closed'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
