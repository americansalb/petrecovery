'use client';

/**
 * The other ways to help, as a plain list of actions. Every row is a real
 * link or button; the page leaves a row out rather than show one that
 * leads nowhere (a flyer row when there is no flyer to print).
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const ROW =
  'flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-midnight-50 focus-visible:bg-midnight-50 focus-visible:outline-none';

function RowBody({ icon: Icon, label, sub }) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-700">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-midnight-900">{label}</span>
        {sub && <span className="block text-sm text-midnight-500">{sub}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-midnight-300" aria-hidden="true" />
    </>
  );
}

export default function WaysToHelp({ title = 'Other ways to help', items }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="help-heading" className="overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
      <h2 id="help-heading" className="px-5 pt-5 text-lg font-semibold text-midnight-900">
        {title}
      </h2>
      <ul className="mt-2 divide-y divide-midnight-100">
        {items.map(({ key, ...item }) => (
          <li key={key}>
            {item.onClick ? (
              <button type="button" onClick={item.onClick} className={ROW}>
                <RowBody {...item} />
              </button>
            ) : item.href.startsWith('#') ? (
              <a href={item.href} className={ROW}>
                <RowBody {...item} />
              </a>
            ) : (
              <Link href={item.href} className={ROW}>
                <RowBody {...item} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
