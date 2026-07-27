'use client';

/**
 * A quiet horizontal sub-navigation under a section header (Meds → Active /
 * History, Health → Overview / Vaccines / Weight / Vet, Profile → About / ID /
 * Photos). Controlled: the page owns the active key. Keeps each subtab a calm,
 * single-purpose screen. Arrow keys move between tabs (roving tabindex), per
 * the tablist pattern the role promises.
 */

import { cn } from '@/components/ui';

export default function SubTabs({ tabs, active, onChange, className }) {
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.id === active);
    const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    e.currentTarget.querySelector(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <div className={cn('flex items-center gap-1 border-b border-care-line', className)} role="tablist" onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative px-3.5 py-2.5 text-[13.5px] font-medium transition-colors -mb-px border-b-2',
              on ? 'text-care-teal border-care-teal' : 'text-care-sub border-transparent hover:text-care-ink'
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 text-[11px] font-semibold text-care-teal">{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
