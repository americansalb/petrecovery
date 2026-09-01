'use client';

/**
 * The public chart: every missing person, alphabetical, with the
 * letters written for them and how many people are writing. Refreshes
 * once a minute so a family watching sees the campaign move. Every row
 * hands off into the wizard with that person picked.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProgressChart() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch('/api/rasuwa/progress')
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (stop) return;
          if (body && body.people) setData(body);
          else if (!data) setFailed(true);
        })
        .catch(() => {
          if (!stop) setFailed(true);
        });
    load();
    const interval = setInterval(load, 60000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        {failed ? 'The chart could not load. Refresh to try again.' : 'Loading the chart...'}
      </p>
    );
  }

  const { people, totals } = data;
  return (
    <div>
      <p className="text-lg font-bold text-slate-900">
        {totals.withLetters} of {totals.people} people have letters on record.
        {totals.needSomeone > 0
          ? ` ${totals.needSomeone} have nobody writing yet.`
          : ' Every person has someone.'}
      </p>
      <ul className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {people.map((p) => (
          <li key={p.key || p.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">{p.name}</span>
              <span className="block text-xs text-slate-500">{p.country}</span>
            </span>
            <span className="flex items-center gap-2 text-xs">
              {p.letters > 0 ? (
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold tabular-nums text-green-800">
                  {p.letters} {p.letters === 1 ? 'letter' : 'letters'}
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2.5 py-1 font-semibold text-slate-600">
                  No letters yet
                </span>
              )}
              {p.writing > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold tabular-nums text-blue-800">
                  {p.writing} writing
                </span>
              )}
            </span>
            <Link
              href={`/rasuwa?for=${p.num}`}
              className="shrink-0 rounded-xl bg-blue-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-900"
            >
              Write for them
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
