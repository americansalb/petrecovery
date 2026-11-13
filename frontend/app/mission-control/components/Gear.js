'use client';

/**
 * What a task comes with: the files the site already made for the pet
 * (flyers to print, pictures to post), the words of a post to copy, the
 * shelters to call and the pages to open. Which task gets which, and what
 * each is called, is `gearFor` in app/lib/searchPlan.js.
 *
 * Founder, 2026-11-13: "Door to door people need to give the flyer, no?
 * Why are we acting as though all these assets cannot assist in the
 * mission control". So the flyer is on the task, one tap from the person
 * who is about to knock on doors.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, ImageDown, Phone, Printer } from 'lucide-react';

const ROW = 'inline-flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-[var(--mc-line-strong)] px-3 py-2 text-left text-[15px] font-bold leading-5 text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const ICON = { print: Printer, picture: ImageDown, call: Phone, link: ExternalLink };

export default function Gear({ items = [], className = '' }) {
  const [copied, setCopied] = useState('');
  if (!items.length) return null;
  async function copy(item) {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(item.label);
    } catch {
      setCopied('');
    }
  }
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {items.map((item) => {
        if (item.type === 'copy') {
          const done = copied === item.label;
          return (
            <li key={item.label}>
              <button type="button" onClick={() => copy(item)} className={ROW}>
                {done ? <Check size={18} aria-hidden="true" className="shrink-0" /> : <Copy size={18} aria-hidden="true" className="shrink-0" />}
                <span aria-live="polite">{done ? 'Copied. Paste it into your post.' : item.label}</span>
              </button>
            </li>
          );
        }
        const Icon = ICON[item.type] || ExternalLink;
        // A phone number dials. Everything else opens beside the search, so the search is still there after.
        const away = item.type === 'call' ? {} : { target: '_blank', rel: 'noopener noreferrer' };
        return (
          <li key={`${item.label}|${item.href}`}>
            <a href={item.href} {...away} className={ROW}>
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 break-words">{item.label}</span>
              {item.detail && <span className="shrink-0 text-[13px] font-medium text-[var(--mc-muted)]">{item.detail}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
