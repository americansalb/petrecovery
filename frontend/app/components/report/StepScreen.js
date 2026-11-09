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

import { useEffect, useRef } from 'react';
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
  wide = false, // wider measure (review poster, option grids)
  fillBody = false, // body stretches (map screens)
}) {
  const theme = WIZARD_THEMES[variant];
  const headingRef = useRef(null);
  const { strip } = useWizardShell();

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepKey]);

  const measure = wide ? 'max-w-3xl' : 'max-w-xl';
  const hasFooter = Boolean(primary || secondary || skip);
  const primaryOff = Boolean(primary && (primary.disabled || primary.loading));

  return (
    <div key={stepKey} className="flex-1 flex flex-col min-h-0 animate-slide-up">
      <div className={`flex-1 min-h-0 ${fillBody ? 'flex flex-col' : 'overflow-y-auto'}`}>
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

          {error && (
            <div
              role="alert"
              className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3"
            >
              <AlertTriangle size={19} className="text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-red-700">Something went wrong</p>
                <p className="text-red-600 mt-0.5">{error}</p>
                {errorLink && (
                  <a href={errorLink.href} className="mt-2 inline-flex font-semibold text-red-700 underline underline-offset-2">
                    {errorLink.label}
                  </a>
                )}
              </div>
            </div>
          )}
          </div>
          {strip && !fillBody && <div className="mt-6 shrink-0 lg:hidden">{strip}</div>}
        </div>
      </div>

      {hasFooter && (
        <footer className="shrink-0 border-t border-midnight-100 bg-white/95 backdrop-blur px-5 sm:px-8 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <div className={`w-full mx-auto ${measure}`}>
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
