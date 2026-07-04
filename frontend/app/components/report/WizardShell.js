'use client';

/**
 * WizardShell — the shared frame for both report wizards.
 *
 * Desktop (lg+): midnight sidebar with brand mark, vertical step checklist,
 * contextual copy for the active step, and a live "building your report"
 * summary. Mobile: compact top bar with back, stamp chip, progress segments
 * and close. Layout is pure CSS breakpoints — no window-width JS.
 *
 * Lives inside app/report/layout.js's `fixed inset-0` overlay, so the shell
 * fills the viewport with h-full.
 */

import Link from 'next/link';
import { ChevronLeft, X, Check, Search } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

export default function WizardShell({
  variant = 'lost',
  steps = [], // [{ id, label, sidebarTitle, sidebarCopy, sidebarIcon }]
  activeStepId,
  summary = [], // [{ icon: Icon, text }] — collected info, shown on desktop
  onBack, // undefined/null hides the back button
  closeHref = '/',
  children,
}) {
  const theme = WIZARD_THEMES[variant];
  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
  const active = steps[activeIndex] || {};
  const SidebarIcon = active.sidebarIcon;

  return (
    <div className="h-full w-full flex bg-white">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[360px] shrink-0 flex-col bg-gradient-to-b from-midnight-950 to-midnight-900 text-white px-9 py-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-white no-underline">
            <span className="w-8 h-8 rounded-lg bg-flash-400 flex items-center justify-center">
              <Search size={16} className="text-midnight-900" />
            </span>
            <span className="font-extrabold text-lg tracking-tight">
              Reunite<span className="text-flash-400">Pets</span>
            </span>
          </Link>
          <Link
            href={closeHref}
            aria-label="Close and leave the report"
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={20} />
          </Link>
        </div>

        <div className="mt-5">
          <span
            className={`inline-block px-3 py-1 rounded-md text-xs font-black tracking-[0.2em] uppercase -rotate-2 ${theme.stampChip}`}
          >
            {theme.stamp} report
          </span>
        </div>

        {/* Step checklist */}
        <nav aria-label="Report progress" className="mt-8 space-y-1.5">
          {steps.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            return (
              <div key={step.id} className="flex items-center gap-3.5">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    current
                      ? 'bg-flash-400 text-midnight-900 shadow-glow-flash'
                      : done
                        ? 'bg-flash-400/20 text-flash-400'
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
              </div>
            );
          })}
        </nav>

        {/* Contextual copy for the active step */}
        <div className="flex-1 flex flex-col justify-center py-8">
          {SidebarIcon && (
            <span className="w-12 h-12 rounded-xl bg-flash-400 flex items-center justify-center mb-4">
              <SidebarIcon size={24} className="text-midnight-900" />
            </span>
          )}
          {active.sidebarTitle && (
            <h2 className="text-2xl font-extrabold leading-snug tracking-tight mb-2.5">
              {active.sidebarTitle}
            </h2>
          )}
          {active.sidebarCopy && (
            <p className="text-white/60 leading-relaxed">{active.sidebarCopy}</p>
          )}

          {summary.length > 0 && (
            <div className="mt-8 p-5 rounded-2xl bg-white/[0.06] border border-white/10">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/40 mb-3">
                Building your report
              </p>
              <div className="space-y-2.5">
                {summary.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 min-w-0">
                      {ItemIcon && <ItemIcon size={15} className="text-flash-400 shrink-0" />}
                      <span className="text-sm text-white/75 truncate">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <p className="text-white/25 text-xs">
          Every minute counts — let&apos;s bring them home.
        </p>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
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
                href={closeHref}
                aria-label="Close and leave the report"
                className="lg:hidden text-midnight-400 hover:text-midnight-700"
              >
                <X size={20} />
              </Link>
            )}
          </div>

          {/* Mobile: stamp + progress segments */}
          <div className="flex-1 flex flex-col items-center gap-1.5 lg:hidden">
            <span
              className={`px-2 py-0.5 rounded text-[0.6rem] font-black tracking-[0.18em] uppercase -rotate-1 ${theme.stampChip}`}
            >
              {theme.stamp}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {steps.map((step, i) => (
                <span
                  key={step.id}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? `w-6 ${theme.progressFill}`
                      : i < activeIndex
                        ? `w-2.5 ${theme.progressFill} opacity-40`
                        : 'w-2.5 bg-midnight-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Desktop: step counter */}
          <div className="hidden lg:block flex-1 text-center text-sm font-medium text-midnight-400">
            Step {activeIndex + 1} of {steps.length}
          </div>

          <div className="w-16 flex justify-end">
            {onBack && (
              <Link
                href={closeHref}
                aria-label="Close and leave the report"
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
