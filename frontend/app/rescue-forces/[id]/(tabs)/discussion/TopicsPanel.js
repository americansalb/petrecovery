'use client';

/**
 * The Discussion's Topics: where a new member starts, the pets being looked
 * for, and the kinds of post, each with how many there are. Tapping a pet
 * or a topic shows only those posts. A tab of its own on a phone, the
 * sidebar beside the posts on a computer.
 */

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PET_COLOR } from '@/app/lib/petColors';

function Heading({ children }) {
  return <h3 className="text-xs font-extrabold uppercase tracking-wider text-midnight-500">{children}</h3>;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function posts(n) {
  return n ? plural(n, 'post', 'posts') : 'No posts yet';
}

function PetThumb({ pet }) {
  const [failed, setFailed] = useState(false);
  const ring = { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${PET_COLOR[pet.status] || PET_COLOR.closed}` };
  if (!pet.photo || failed) {
    return (
      <span className="m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-400" style={ring}>
        <SpeciesIcon species={String(pet.species || '').toUpperCase()} size={18} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pet.photo} alt="" onError={() => setFailed(true)} className="m-1 h-9 w-9 shrink-0 rounded-full object-cover" style={ring} />
  );
}

const ROW = 'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-midnight-50';

export default function TopicsPanel({ summary, onFilter }) {
  const t = summary.topics;
  const topics = [
    { key: 'SEARCH_PARTY', label: 'Search parties', note: t.SEARCH_PARTY.upcoming ? `${t.SEARCH_PARTY.upcoming} coming up` : 'None planned' },
    { key: 'SIGHTING', label: 'Sightings', note: t.SIGHTING.thisWeek ? `${t.SIGHTING.thisWeek} this week` : posts(t.SIGHTING.total) },
    { key: 'QUESTION', label: 'Questions', note: posts(t.QUESTION.total) },
    { key: 'FLYERS', label: 'Flyers', note: posts(t.FLYERS.total) },
    { key: 'HELLO', label: 'Say hello', note: 'New neighbors introduce themselves' },
  ];

  return (
    <div className="space-y-6">
      <section>
        <Heading>Start here</Heading>
        <Link href="/advice" className={`${ROW} mt-1`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flash-100 text-flash-900" aria-hidden="true">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="flex-1 font-semibold text-midnight-900">What to do when a pet goes missing</span>
          <ChevronRight className="h-4 w-4 text-midnight-400" aria-hidden="true" />
        </Link>
      </section>

      {summary.pets.length > 0 && (
        <section>
          <Heading>Pets we are looking for</Heading>
          <ul className="mt-1">
            {summary.pets.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onFilter({ caseId: p.id, label: p.name })} className={ROW}>
                  <PetThumb pet={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-midnight-900">{p.name}</span>
                    <span className="block text-sm text-midnight-500">
                      {[posts(p.posts), p.parties > 0 && plural(p.parties, 'search party', 'search parties')]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-midnight-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <Heading>Topics</Heading>
        <ul className="mt-1">
          {topics.map((topic) => (
            <li key={topic.key}>
              <button type="button" onClick={() => onFilter({ topic: topic.key, label: topic.label })} className={ROW}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-midnight-900">{topic.label}</span>
                  <span className="block text-sm text-midnight-500">{topic.note}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-midnight-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
