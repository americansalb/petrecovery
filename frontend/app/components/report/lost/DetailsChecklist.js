'use client';

/**
 * DetailsChecklist - the optional questions as a list the owner can work
 * through in any order: what is answered, what is not, and a progress
 * line. On the review screen before posting, on the page after, and in
 * the owner's panel on the pet's page. With `limit`, the unanswered
 * questions come first and the rest wait behind "All 9 questions".
 */

import { useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { DETAIL_SCREENS, detailsProgress, screenAnswered } from '@/app/lib/caseDetails';

export default function DetailsChecklist({ details, breed, name, onOpen, title = 'Make the flyer stronger', intro, limit }) {
  const [expanded, setExpanded] = useState(false);
  const progress = detailsProgress(details, { breed });
  const left = progress.total - progress.answered;
  const rows = [...DETAIL_SCREENS].sort((a, b) => Number(screenAnswered(a.id, details, { breed })) - Number(screenAnswered(b.id, details, { breed })));
  const shown = limit && !expanded && rows.length > limit ? rows.slice(0, limit) : rows;
  return (
    <section aria-labelledby="details-checklist-heading" className="rounded-2xl border border-midnight-200 bg-white p-4 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="details-checklist-heading" className="text-[19px] font-extrabold leading-6 text-midnight-900">
          {title}
        </h2>
        <span className="shrink-0 text-[13px] font-bold text-midnight-500">
          {left === 0 ? 'All answered' : `${left} left`}
        </span>
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-midnight-600">{intro || `One tap each. Each answer goes on ${name}'s flyer and page.`}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-midnight-100" aria-hidden="true">
        <div className="h-full rounded-full bg-midnight-900 transition-all" style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
      </div>
      <ul className="mt-2 divide-y divide-midnight-100">
        {shown.map((s) => {
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
                    done ? 'bg-green-600 text-white' : 'border-2 border-dashed border-midnight-300 text-midnight-500'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                </span>
                <span className={`flex-1 text-[15px] ${done ? 'font-medium text-midnight-500' : 'font-semibold text-midnight-900'}`}>
                  {done ? s.label : s.question(name)}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-midnight-500">{done ? 'Edit' : 'Add'}</span>
                <ChevronRight size={16} className="text-midnight-300" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {limit && rows.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 flex min-h-[44px] w-full items-center justify-center text-[15px] font-bold text-midnight-900 underline underline-offset-4 decoration-midnight-300"
        >
          {expanded ? 'Fewer' : `All ${rows.length} questions`}
        </button>
      )}
    </section>
  );
}
