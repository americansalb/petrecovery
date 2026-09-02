'use client';

/**
 * The public chart: the campaign's collective numbers (letters on
 * record, offices written to, the last day's pace, most-written
 * offices), then every missing person, alphabetical, with the letters
 * written for them and how many people are writing. Refreshes once a
 * minute so a family watching sees the campaign move. Every row hands
 * off into the wizard with that person picked.
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

  const { people, totals, general, summary } = data;
  const generalLetters = general ? general.letters : 0;
  return (
    <div>
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Records are composed letters; the site never claims a
                letter was delivered, so the band says "addressed",
                not "written to" (review finding on PR #235). */}
            {[
              [summary.letters, 'Letters on record'],
              [summary.offices, 'Offices addressed'],
              [summary.last24h, 'Letters in the last 24 hours'],
              [`${totals.withLetters} of ${totals.people}`, 'People with letters'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="block text-2xl font-semibold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString('en-US') : value}
                </span>
                <span className="block text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
          {summary.topOffices && summary.topOffices.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Most letters so far:</span>
              {summary.topOffices.map((o) => (
                <span
                  key={o.name}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                >
                  {o.name}{o.count > 1 ? ` ×${o.count}` : ''}
                </span>
              ))}
            </p>
          )}
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {totals.needSomeone > 0
              ? `${totals.needSomeone} have nobody writing yet. Pick one below.`
              : 'Every person has someone writing.'}
          </p>
        </>
      ) : (
        <p className="text-lg font-bold text-slate-900">
          {totals.withLetters} of {totals.people} people have letters on record.
          {totals.needSomeone > 0
            ? ` ${totals.needSomeone} have nobody writing yet.`
            : ' Every person has someone.'}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-500">
        See a mistake in someone&apos;s details?{' '}
        <Link className="font-semibold text-blue-800 underline" href="/rasuwa/correction">
          Ask for a correction
        </Link>
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">For all of the missing</span>
          <span className="block text-xs text-slate-500">
            One letter that stands for everyone on the list, no one person named.
          </span>
          {general && general.offices && general.offices.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {general.offices.map((o) => (
                <span
                  key={o.name}
                  className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                >
                  {o.name}{o.count > 1 ? ` ×${o.count}` : ''}
                </span>
              ))}
            </span>
          )}
        </span>
        {generalLetters > 0 && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-green-800">
            {generalLetters} {generalLetters === 1 ? 'letter' : 'letters'}
          </span>
        )}
        <Link
          href="/rasuwa?for=all"
          className="shrink-0 rounded-xl bg-blue-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-900"
        >
          Write for everyone
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {people.map((p) => (
          <li key={p.key || p.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">{p.name}</span>
              <span className="block text-xs text-slate-500">
                {p.country}
                {' · '}
                <Link className="underline hover:text-slate-700" href={`/rasuwa/correction?for=${p.num}`}>
                  Report a mistake
                </Link>
              </span>
              {p.offices && p.offices.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.offices.map((o) => (
                    <span
                      key={o.name}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                    >
                      {o.name}{o.count > 1 ? ` ×${o.count}` : ''}
                    </span>
                  ))}
                </span>
              )}
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
