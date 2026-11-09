'use client';

/**
 * ReportChooser - the two ways to report, asked before either wizard opens.
 *
 * The tab bar's yellow "+" used to open the lost-pet wizard straight away,
 * and people who had FOUND an animal landed on "What kind of pet is
 * missing?", backed out, and hunted for the other path. Now the "+" asks
 * the one question that matters first. Same sheet for every person on every
 * route; nothing in it depends on who is signed in.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function ReportChooser({ open, onClose }) {
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="report-chooser-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-midnight-950/60" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="report-chooser-title" className="text-lg font-extrabold tracking-tight text-midnight-900">
            Which one happened?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-midnight-500 hover:bg-midnight-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <Link
            ref={firstRef}
            href="/report/new"
            onClick={onClose}
            className="flex min-h-[72px] items-center gap-4 rounded-2xl border-2 border-midnight-200 bg-white px-5 py-4 no-underline hover:border-midnight-400"
          >
            <span className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">Lost</span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-tight text-midnight-900">My pet is lost</span>
              <span className="block text-sm text-midnight-500">Post the alert and get the flyer.</span>
            </span>
          </Link>
          <Link
            href="/report/found"
            onClick={onClose}
            className="flex min-h-[72px] items-center gap-4 rounded-2xl border-2 border-midnight-200 bg-white px-5 py-4 no-underline hover:border-midnight-400"
          >
            <span className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">Found</span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-tight text-midnight-900">I found a pet</span>
              <span className="block text-sm text-midnight-500">A photo and where you found them.</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
