'use client';

/**
 * StepScreen - the one-bold-question scaffold every wizard step renders in.
 *
 * Handles: heading focus on step change (a11y - the question guides the eye),
 * slide-up entrance, consistent measure/padding, error banner, and the sticky
 * footer action bar (safe-area aware). Steps whose options advance on tap
 * simply pass no primary action and get no footer.
 *
 * The footer holds one yellow button, Continue (or Post on the last step),
 * and the skip beside it, not under it: two choices side by side read as
 * two choices, a small link under a grey button read as an afterthought.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';
import { useWizardShell } from './WizardShell';

const SIDE_BUTTON =
  'shrink-0 max-w-[48%] min-h-[54px] px-3.5 rounded-xl border-2 border-midnight-300 bg-white text-[14px] leading-tight font-bold text-midnight-700 hover:border-midnight-500 transition-colors';

export default function StepScreen({
  stepKey, // unique per step - remounts content so the entrance replays
  variant = 'lost',
  eyebrow,
  question,
  hint,
  children,
  primary, // { label, onClick, disabled, loading, loadingLabel, tone: 'default'|'post' }
  secondary, // { label, onClick }
  skip, // { label, onClick }
  footerNote, // one line under the buttons
  error,
  errorLink, // { href, label }: the one thing that resolves the error, e.g. sign in
  errorAction, // { label, onClick }: the other way out, e.g. change the number
  wide = false, // wider measure (review poster, option grids)
  fillBody = false, // body stretches (map screens)
}) {
  const theme = WIZARD_THEMES[variant];
  const headingRef = useRef(null);
  const { strip } = useWizardShell();

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepKey]);

  // When the body can scroll further, a fade at its foot says so: on a short
  // laptop the last option or the flyer line used to end mid-word against
  // the Continue bar with nothing to show that more was below.
  const scrollRef = useRef(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || fillBody) return undefined;
    const check = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 12);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (ro && el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, [stepKey, fillBody]);

  const measure = wide ? 'max-w-3xl' : 'max-w-xl';
  const hasFooter = Boolean(primary || secondary || skip);
  const primaryOff = Boolean(primary && (primary.disabled || primary.loading));

  // The error used to sit at the end of the body, under the flyer: on a
  // computer the founder pressed Post, nothing seemed to happen, and he
  // found out why only after scrolling. It sits above the buttons now, in
  // view, takes focus when it appears, and offers the ways out.
  const errorRef = useRef(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const errorBox = error ? (
    <div
      ref={errorRef}
      tabIndex={-1}
      role="alert"
      className="mb-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 outline-none"
    >
      <AlertTriangle size={19} className="mt-0.5 shrink-0 text-red-500" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-red-700">Not posted yet</p>
        <p className="mt-0.5 text-red-600">{error}</p>
        {(errorLink || errorAction) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {errorLink && (
              <a
                href={errorLink.href}
                className="inline-flex min-h-[40px] items-center rounded-xl bg-red-600 px-3.5 text-[14px] font-bold text-white no-underline hover:bg-red-700"
              >
                {errorLink.label}
              </a>
            )}
            {errorAction && (
              <button
                type="button"
                onClick={errorAction.onClick}
                className="inline-flex min-h-[40px] items-center rounded-xl border-2 border-red-300 bg-white px-3.5 text-[14px] font-bold text-red-700 hover:border-red-500"
              >
                {errorAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div key={stepKey} className="flex-1 flex flex-col min-h-0 animate-slide-up">
      <div className="relative flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} className={`flex-1 min-h-0 ${fillBody ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {/* A short question sits in the middle of the room it has instead of
            at the top of a white page; the strip, on a phone, takes the foot.
            my-auto on the block, not justify-center on the parent, so a tall
            screen still scrolls from its top. */}
        <div
          className={`w-full mx-auto px-5 sm:px-8 pt-5 lg:pt-10 ${measure} ${
            fillBody ? 'flex-1 flex flex-col min-h-0 pb-4' : 'flex min-h-full flex-col pb-6'
          }`}
        >
          <div className={fillBody ? 'flex-1 flex flex-col min-h-0' : 'my-auto'}>
          {eyebrow && (
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] mb-2 text-midnight-500">
              {eyebrow}
            </p>
          )}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.65rem] leading-tight lg:text-[2.4rem] font-extrabold tracking-tight text-midnight-900"
            style={{ outline: 'none' }} /* beats the global :focus-visible rule */
          >
            {question}
          </h1>
          {hint && <p className="text-midnight-500 mt-2 leading-relaxed">{hint}</p>}

          <div className={fillBody ? 'flex-1 flex flex-col min-h-0 mt-5' : 'mt-6 lg:mt-8'}>{children}</div>

          {!hasFooter && errorBox && <div className="mt-5">{errorBox}</div>}
          </div>
          {strip && !fillBody && <div className="mt-6 shrink-0 lg:hidden">{strip}</div>}
        </div>
      </div>
      {moreBelow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/80 to-transparent"
        />
      )}
      </div>

      {hasFooter && (
        <footer className="shrink-0 border-t border-midnight-100 bg-white/95 backdrop-blur px-5 sm:px-8 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <div className={`w-full mx-auto ${measure}`}>
            {errorBox}
            <div className="flex items-stretch gap-2.5">
              {secondary && (
                <button type="button" onClick={secondary.onClick} className={SIDE_BUTTON}>
                  {secondary.label}
                </button>
              )}
              {skip && (
                <button type="button" onClick={skip.onClick} className={SIDE_BUTTON}>
                  {skip.label}
                </button>
              )}
              {primary && (
                <button
                  type="button"
                  onClick={primary.onClick}
                  disabled={primaryOff}
                  className={`flex-1 min-h-[54px] rounded-xl font-extrabold text-base flex items-center justify-center gap-1.5 transition-all active:scale-[0.985] ${
                    primaryOff
                      ? 'bg-midnight-100 text-midnight-400 cursor-not-allowed'
                      : primary.tone === 'post'
                        ? theme.postCta
                        : theme.primaryCta
                  }`}
                >
                  {primary.loading ? (
                    <>
                      <Loader2 size={19} className="animate-spin" />
                      {primary.loadingLabel || 'Working…'}
                    </>
                  ) : (
                    <>
                      {primary.label}
                      {primary.tone !== 'post' && <ChevronRight size={19} />}
                    </>
                  )}
                </button>
              )}
            </div>
            {footerNote && (
              <p className="mt-2.5 text-center text-[13px] leading-snug text-midnight-500">{footerNote}</p>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
