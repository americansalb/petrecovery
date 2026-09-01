'use client';

/**
 * RasuwaWizardShell - the frame for the /rasuwa letter wizard, modeled
 * on the report wizards' WizardShell but carrying the family campaign's
 * own identity (civic blue, rescueourfamily.org wordmark), never the
 * pet site's. Desktop: deep-blue sidebar with the step checklist and
 * contextual copy. Mobile: compact top bar with back, progress
 * segments, and close. The page gives this a bounded height (h-dvh);
 * each step scrolls inside StepScreen.
 *
 * Closing needs no confirmation: entries persist as a tab draft
 * (letterDraft.js), so leaving loses nothing.
 */

import Link from 'next/link';
import { ChevronLeft, X, Check } from 'lucide-react';

export default function RasuwaWizardShell({
  steps = [], // [{ id, label, sidebarTitle, sidebarCopy }]
  activeStepId,
  summary = [], // [{ text }]
  preview, // letter text shown live in the sidebar while it is built
  onBack, // undefined hides the back button
  onStepSelect, // jump to any step from the checklist or the dots
  children,
}) {
  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
  const active = steps[activeIndex] || {};

  return (
    <div className="h-full w-full flex bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[360px] shrink-0 flex-col bg-gradient-to-b from-blue-950 to-blue-900 text-white px-9 py-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-700 border-t-2 border-blue-300 flex items-center justify-center font-extrabold text-white">
              R
            </span>
            <span className="font-extrabold text-lg tracking-tight">rescueourfamily.org</span>
          </span>
          <Link
            href="/"
            aria-label="Leave the letter wizard"
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={20} />
          </Link>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
          Rasuwa flood, Nepal
        </p>

        <nav aria-label="Letter progress" className="mt-6 space-y-1.5">
          {steps.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            const row = (
              <>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    current
                      ? 'bg-blue-300 text-blue-950'
                      : done
                        ? 'bg-blue-300/20 text-blue-300'
                        : 'bg-white/10 text-white/30'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={`text-sm transition-colors duration-300 ${
                    current ? 'text-white font-semibold' : done ? 'text-white/70' : 'text-white/30'
                  }`}
                >
                  {step.label}
                </span>
              </>
            );
            // Every step is a door (founder rule, 2026-08-31: click
            // anywhere in the sequence). Screens ahead render safely
            // with whatever is filled in so far; nothing is lost by
            // jumping around.
            return onStepSelect ? (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepSelect(step.id)}
                className="flex w-full items-center gap-3.5 rounded-lg -mx-1.5 px-1.5 py-0.5 hover:bg-white/10 transition-colors text-left"
                title={`Go to ${step.label}`}
              >
                {row}
              </button>
            ) : (
              <div key={step.id} className="flex items-center gap-3.5 py-0.5">
                {row}
              </div>
            );
          })}
        </nav>

        <div className="flex-1 flex flex-col justify-center py-8">
          {active.sidebarTitle && (
            <h2 className="text-2xl font-extrabold leading-snug tracking-tight mb-2.5">
              {active.sidebarTitle}
            </h2>
          )}
          {active.sidebarCopy && <p className="text-white/60 leading-relaxed">{active.sidebarCopy}</p>}

          {summary.length > 0 && (
            <div className="mt-8 p-5 rounded-2xl bg-white/[0.06] border border-white/10">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/40 mb-3">
                Building your letters
              </p>
              <div className="space-y-2.5">
                {summary.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 min-w-0">
                    <Check size={15} className="text-blue-300 shrink-0" />
                    <span className="text-sm text-white/75 truncate">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="mt-5 rounded-2xl bg-white border border-white/10 overflow-hidden">
              <p className="px-4 pt-3 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-blue-900">
                Letter preview, live
              </p>
              <pre className="max-h-64 overflow-y-auto px-4 pb-4 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-700">
                {preview}
              </pre>
            </div>
          )}
        </div>

        <p className="text-white/25 text-xs">Time matters in a search.</p>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 flex items-center gap-3 px-4 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:border-b lg:border-midnight-100">
          <div className="w-16 flex justify-start">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-0.5 text-midnight-500 hover:text-midnight-900 font-medium text-sm transition-colors"
              >
                <ChevronLeft size={20} />
                Back
              </button>
            ) : (
              <Link
                href="/"
                aria-label="Leave the letter wizard"
                className="lg:hidden text-midnight-400 hover:text-midnight-700"
              >
                <X size={20} />
              </Link>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center gap-1.5 lg:hidden">
            <span className="px-2 py-0.5 rounded text-[0.6rem] font-black tracking-[0.18em] uppercase bg-blue-800 text-white">
              Rasuwa
            </span>
            <div className="flex gap-1">
              {steps.map((step, i) => {
                const seg = (
                  <span
                    className={`block h-1 rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? 'w-6 bg-blue-800'
                        : i < activeIndex
                          ? 'w-2.5 bg-blue-800 opacity-40'
                          : 'w-2.5 bg-midnight-200'
                    }`}
                  />
                );
                return onStepSelect ? (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onStepSelect(step.id)}
                    className="py-2 -my-2"
                    aria-label={`Go to step ${i + 1}: ${step.label}`}
                  >
                    {seg}
                  </button>
                ) : (
                  <span key={step.id} aria-hidden="true">{seg}</span>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:block flex-1 text-center text-sm font-medium text-midnight-400">
            Step {activeIndex + 1} of {steps.length}
          </div>

          <div className="w-16 flex justify-end">
            {onBack && (
              <Link
                href="/"
                aria-label="Leave the letter wizard"
                className="lg:hidden text-midnight-300 hover:text-midnight-600"
              >
                <X size={18} />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </div>
    </div>
  );
}
