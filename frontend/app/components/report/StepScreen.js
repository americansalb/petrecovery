'use client';

/**
 * StepScreen — the one-bold-question scaffold every wizard step renders in.
 *
 * Handles: heading focus on step change (a11y — the question guides the eye),
 * slide-up entrance, consistent measure/padding, error banner, and the sticky
 * footer action bar (safe-area aware). Steps whose options advance on tap
 * simply pass no primary action and get no footer.
 */

import { useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

export default function StepScreen({
  stepKey, // unique per step — remounts content so the entrance replays
  variant = 'lost',
  eyebrow,
  question,
  hint,
  children,
  primary, // { label, onClick, disabled, loading, tone: 'default'|'post' }
  secondary, // { label, onClick }
  skip, // { label, onClick }
  error,
  wide = false, // wider measure (review poster, option grids)
  fillBody = false, // body stretches (map screens)
}) {
  const theme = WIZARD_THEMES[variant];
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepKey]);

  const measure = wide ? 'max-w-3xl' : 'max-w-xl';
  const hasFooter = Boolean(primary || secondary || skip);

  return (
    <div key={stepKey} className="flex-1 flex flex-col min-h-0 animate-slide-up">
      <div className={`flex-1 min-h-0 ${fillBody ? 'flex flex-col' : 'overflow-y-auto'}`}>
        <div
          className={`w-full mx-auto px-5 sm:px-8 pt-5 lg:pt-10 ${measure} ${
            fillBody ? 'flex-1 flex flex-col min-h-0 pb-4' : 'pb-8'
          }`}
        >
          {eyebrow && (
            <p className={`text-xs font-extrabold uppercase tracking-[0.18em] mb-2 ${theme.accentText}`}>
              {eyebrow}
            </p>
          )}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.65rem] leading-tight lg:text-[2.1rem] font-extrabold tracking-tight text-midnight-900"
            style={{ outline: 'none' }} /* beats the global :focus-visible rule */
          >
            {question}
          </h1>
          {hint && <p className="text-midnight-500 mt-2 leading-relaxed">{hint}</p>}

          <div className={fillBody ? 'flex-1 flex flex-col min-h-0 mt-5' : 'mt-7'}>{children}</div>

          {error && (
            <div
              role="alert"
              className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3"
            >
              <AlertTriangle size={19} className="text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-red-700">Something went wrong</p>
                <p className="text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasFooter && (
        <footer className="shrink-0 border-t border-midnight-100 bg-white/95 backdrop-blur px-5 sm:px-8 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <div className={`w-full mx-auto ${measure}`}>
            <div className="flex items-center gap-3">
              {secondary && (
                <button
                  type="button"
                  onClick={secondary.onClick}
                  className="px-5 py-3.5 rounded-2xl font-semibold text-midnight-600 bg-midnight-100 hover:bg-midnight-200 transition-colors"
                >
                  {secondary.label}
                </button>
              )}
              {primary && (
                <button
                  type="button"
                  onClick={primary.onClick}
                  disabled={primary.disabled || primary.loading}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.985] ${
                    primary.disabled || primary.loading
                      ? 'bg-midnight-100 text-midnight-300 cursor-not-allowed'
                      : primary.tone === 'post'
                        ? theme.postCta
                        : 'bg-midnight-900 text-white shadow-lg hover:bg-midnight-800'
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
            {skip && (
              <div className="text-center mt-2.5">
                <button
                  type="button"
                  onClick={skip.onClick}
                  className="text-sm font-medium text-midnight-400 hover:text-midnight-600 underline underline-offset-4 decoration-midnight-200 transition-colors"
                >
                  {skip.label}
                </button>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
