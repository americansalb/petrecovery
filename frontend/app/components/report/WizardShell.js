'use client';

/**
 * WizardShell - the shared frame for both report wizards.
 *
 * Desktop (lg+): navy sidebar with the brand mark, the report's groups as a
 * checklist (the current group opened to show its screens), and the flyer
 * drawn from the answers so far. Mobile: a compact top bar with Back, the
 * stamp and Close. On both, a progress line that fills across the whole
 * report and a label that says where you are inside the group ("For
 * finders, 4 of 11"), so the long middle of the report never looks stuck.
 * Layout is pure CSS breakpoints - no window-width JS.
 *
 * Lives inside app/report/layout.js's `fixed inset-0` overlay, so the shell
 * fills the viewport with h-full.
 */

import { cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, X, Check, Search } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

/** What a step screen can ask the shell for: the strip it shows at its foot on a phone. */
const WizardContext = createContext({ strip: null });
export function useWizardShell() {
  return useContext(WizardContext);
}

export default function WizardShell({
  variant = 'lost',
  steps = [], // the groups: [{ id, label, sidebarTitle, sidebarCopy, sidebarIcon }]
  activeStepId, // the current group's id
  substeps = [], // the current group's screens: [{ id, label, state: 'done'|'current'|'todo' }]
  progress = null, // { done, total } over every screen of this report
  position = null, // { index, total } inside the current group
  preview = null, // the flyer so far, shown in the sidebar
  previewLabel = 'The flyer so far',
  strip = null, // the flyer so far as a small card at the foot of each screen on a phone
  summary = [], // [{ icon: Icon, text }] - collected info, shown on desktop when there is no preview
  onBack, // undefined/null hides the back button
  onStepSelect, // (id) a finished group or screen in the sidebar was chosen
  closeHref = '/',
  dirty = false, // unsaved report data - closing asks for confirmation
  children,
}) {
  const theme = WIZARD_THEMES[variant];
  const router = useRouter();
  const [confirmLeave, setConfirmLeave] = useState(false);

  // The flyer in the sidebar fits the height the sidebar has left; a short
  // laptop at 110% zoom used to cut it off at the bottom edge.
  const previewBoxRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(272);
  const hasPreview = Boolean(preview);
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el || !hasPreview || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      const room = el.clientHeight - 34; // the label above the sheet
      const w = Math.round(room / 1.3); // a letter sheet is 1.3 times as tall as it is wide
      setPreviewWidth(Math.max(120, Math.min(272, Number.isFinite(w) ? w : 272)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasPreview]);
  const sizedPreview = isValidElement(preview) ? cloneElement(preview, { width: previewWidth }) : preview;
  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
  const active = steps[activeIndex] || {};
  const pct =
    progress && progress.total > 0
      ? Math.round((Math.min(progress.done, progress.total) / progress.total) * 100)
      : steps.length > 0
        ? Math.round((activeIndex / steps.length) * 100)
        : 0;

  const requestClose = (e) => {
    if (dirty) {
      e.preventDefault();
      setConfirmLeave(true);
    }
    // not dirty: let the Link navigate normally
  };

  const progressLine = (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1 overflow-hidden rounded-full bg-midnight-200"
        role="progressbar"
        aria-label="Report progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${theme.progressFill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[13px] leading-tight">
        <span className="font-bold text-midnight-900 truncate">{active.label}</span>
        {progress && progress.total > 0 && (
          <span className="shrink-0 text-midnight-500">
            {Math.min(progress.done, progress.total)} of {progress.total}
          </span>
        )}
      </div>
    </div>
  );

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
            onClick={requestClose}
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

        {/* Group checklist, the current group opened */}
        <nav aria-label="Report progress" className="mt-7 space-y-1">
          {steps.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            const RowTag = done && onStepSelect ? 'button' : 'div';
            const rowProps =
              done && onStepSelect
                ? { type: 'button', onClick: () => onStepSelect(step.id), 'aria-label': `Back to ${step.label}` }
                : {};
            return (
              <div key={step.id}>
                <RowTag
                  {...rowProps}
                  className={`flex w-full items-center gap-3.5 min-h-[32px] text-left ${
                    done && onStepSelect ? 'group/row cursor-pointer rounded-lg -mx-1.5 px-1.5 hover:bg-white/[0.06]' : ''
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
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
                  {current && position && (
                    <span className="ml-auto text-xs text-white/40">
                      {position.index} of {position.total}
                    </span>
                  )}
                  {done && onStepSelect && (
                    <span className="ml-auto text-xs text-white/0 group-hover/row:text-white/50">Change</span>
                  )}
                </RowTag>
                {current && substeps.length > 1 && (
                  <ol className="ml-[2.4rem] mt-0.5 mb-1.5">
                    {substeps.map((s) => (
                      <li
                        key={s.id}
                        className={`text-[13px] leading-6 ${
                          s.state === 'current'
                            ? 'font-bold text-white'
                            : s.state === 'done'
                              ? 'text-white/50'
                              : 'text-white/30'
                        }`}
                        aria-current={s.state === 'current' ? 'step' : undefined}
                      >
                        {s.state === 'done' && onStepSelect ? (
                          <button type="button" onClick={() => onStepSelect(s.id)} className="hover:text-white hover:underline">
                            {s.label}
                          </button>
                        ) : (
                          s.label
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </nav>

        {/* The group's copy right under the steps, and the flyer so far under that */}
        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6">
          {/* On a short window the copy gives way to the flyer */}
          {(active.sidebarTitle || active.sidebarCopy) && (
            <div className="[@media(max-height:720px)]:hidden">
              {active.sidebarTitle && (
                <h2 className="text-lg font-extrabold leading-snug tracking-tight">{active.sidebarTitle}</h2>
              )}
              {active.sidebarCopy && <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{active.sidebarCopy}</p>}
            </div>
          )}
          {preview ? (
            <div ref={previewBoxRef} className="min-h-[200px] flex-1">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/50">{previewLabel}</p>
              <div className="mt-2.5 w-fit overflow-hidden rounded-lg shadow-2xl shadow-black/50">{sizedPreview}</div>
            </div>
          ) : (
            summary.length > 0 && (
              <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/10">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/40 mb-3">Building your report</p>
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
            )
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="shrink-0 px-4 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 lg:pb-3 lg:border-b lg:border-midnight-100">
          <div className="flex items-center gap-3 min-h-[44px]">
            <div className="w-16 flex justify-start">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-0.5 min-h-[44px] text-midnight-500 hover:text-midnight-900 font-medium text-sm transition-colors"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
              ) : (
                <Link
                  href={closeHref}
                  onClick={requestClose}
                  aria-label="Close and leave the report"
                  className="lg:hidden flex items-center min-h-[44px] text-midnight-400 hover:text-midnight-700"
                >
                  <X size={20} />
                </Link>
              )}
            </div>

            {/* Mobile: the stamp. Desktop: the progress line. */}
            <div className="flex-1 flex justify-center lg:hidden">
              <span
                className={`px-2 py-0.5 rounded text-[0.6rem] font-black tracking-[0.18em] uppercase -rotate-1 ${theme.stampChip}`}
              >
                {theme.stamp}
              </span>
            </div>
            <div className="hidden lg:block flex-1 max-w-2xl mx-auto">{progressLine}</div>

            <div className="w-16 flex justify-end">
              {onBack && (
                <Link
                  href={closeHref}
                  onClick={requestClose}
                  aria-label="Close and leave the report"
                  className="lg:hidden flex items-center min-h-[44px] text-midnight-300 hover:text-midnight-600"
                >
                  <X size={18} />
                </Link>
              )}
            </div>
          </div>
          <div className="lg:hidden mt-1">{progressLine}</div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          <WizardContext.Provider value={{ strip }}>{children}</WizardContext.Provider>
        </main>
      </div>

      {/* Leave confirmation */}
      {confirmLeave && (
        <div
          className="absolute inset-0 z-[600] flex items-center justify-center p-6 bg-midnight-950/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-confirm-title"
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-card-hover p-6 text-center">
            <h2 id="leave-confirm-title" className="text-xl font-extrabold tracking-tight text-midnight-900">
              Leave without posting?
            </h2>
            <p className="text-sm text-midnight-500 mt-2 leading-relaxed">
              Your report isn&apos;t posted yet. We&apos;ll keep what you&apos;ve entered in case you
              come back.
            </p>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                autoFocus
                style={{ outline: 'none' }} /* beats the global :focus-visible rule */
                className="w-full py-3 rounded-2xl font-bold bg-midnight-900 text-white hover:bg-midnight-800 transition-all focus-visible:ring-2 focus-visible:ring-flash-400 focus-visible:ring-offset-2"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => router.push(closeHref)}
                className="w-full py-3 rounded-2xl font-semibold text-midnight-500 hover:text-midnight-700 hover:bg-midnight-100 transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
