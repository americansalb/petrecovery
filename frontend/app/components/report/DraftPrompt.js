'use client';

/**
 * DraftPrompt - the "pick up where you left off?" screen shown when a
 * wizard mounts with an unfinished draft in sessionStorage. Restoring is a
 * choice, not a silent prefill: a stressed reporter starting a NEW report
 * must never inherit stale answers without noticing.
 */

import { History } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

export default function DraftPrompt({ variant = 'lost', summary, onResume, onStartFresh, resumeLabel = 'Resume my report' }) {
  const theme = WIZARD_THEMES[variant];

  return (
    <div className="flex-1 flex items-center justify-center px-6 animate-slide-up">
      <div className="w-full max-w-sm text-center">
        <span className={`inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5 ${theme.softBg}`}>
          <History size={28} className={theme.accentText} />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-midnight-900">
          Pick up where you left off?
        </h1>
        {summary && <p className="text-midnight-500 mt-2 leading-relaxed">{summary}</p>}
        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={onResume}
            autoFocus
            style={{ outline: 'none' }} /* beats the global :focus-visible rule */
            className="w-full py-3.5 rounded-2xl font-bold bg-midnight-900 text-white shadow-lg hover:bg-midnight-800 transition-all focus-visible:ring-2 focus-visible:ring-flash-400 focus-visible:ring-offset-2"
          >
            {resumeLabel}
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="w-full py-3.5 rounded-2xl font-semibold text-midnight-600 bg-midnight-100 hover:bg-midnight-200 transition-colors"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
