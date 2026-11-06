'use client';

/**
 * DetailsChecklist - the optional questions as a list the owner can work
 * through in any order: what is answered, what is not, and a progress
 * line. On the review screen before posting, on the success screen after,
 * and in the owner's panel on the pet's page.
 */

import { Check, ChevronRight, Plus } from 'lucide-react';
import { DETAIL_SCREENS, detailsProgress, screenAnswered } from '@/app/lib/caseDetails';

export default function DetailsChecklist({ details, breed, name, onOpen, title = 'Make the flyer stronger', intro }) {
  const progress = detailsProgress(details, { breed });
  const rows = [...DETAIL_SCREENS].sort((a, b) => Number(screenAnswered(a.id, details, { breed })) - Number(screenAnswered(b.id, details, { breed })));
  return (
    <section aria-labelledby="details-checklist-heading" className="rounded-2xl border border-midnight-100 bg-white p-4 text-left shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="details-checklist-heading" className="text-base font-extrabold text-midnight-900">
          {title}
        </h2>
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-midnight-500">
          {progress.answered} of {progress.total}
        </span>
      </div>
      <p className="mt-1 text-sm text-midnight-500">{intro || `Each one is a tap. All of it goes on ${name}'s flyer and page. Skip what you don't know.`}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-midnight-100" aria-hidden="true">
        <div className="h-full rounded-full bg-midnight-900 transition-all" style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-midnight-100">
        {rows.map((s) => {
          const done = screenAnswered(s.id, details, { breed });
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left hover:bg-midnight-50"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    done ? 'bg-green-600 text-white' : 'border-2 border-dashed border-midnight-300 text-midnight-400'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                </span>
                <span className={`flex-1 text-sm ${done ? 'font-medium text-midnight-500' : 'font-semibold text-midnight-900'}`}>{s.label}</span>
                <span className="text-xs font-bold uppercase tracking-wide text-midnight-400">{done ? 'Edit' : 'Add'}</span>
                <ChevronRight size={16} className="text-midnight-300" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
