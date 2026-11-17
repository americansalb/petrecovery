'use client';

/**
 * The safety rules and the waiver, full screen, from "Read them" on the
 * join card.
 *
 * They were poured into a box 224 px tall inside the card, as raw markdown
 * ("# Liability Waiver ...", "- You will ..."), in a box that scrolled
 * inside a sheet that scrolls (founder, on the phone: "Terrible UX over the
 * phone wow"). Here they take the whole screen, set as headings, paragraphs
 * and lists at 16 px, with a close button at the top that does not scroll
 * away and another at the end.
 *
 * The words are passed in and are never changed here: the rules are
 * app/lib/safetyRules.js, and the waiver is the text the site serves for
 * the version being agreed to (prisma/legal/liability-waiver.js, by way of
 * /api/legal/documents/liability-waiver), read by app/lib/legalBlocks.js.
 *
 * It is drawn on the page's body, over everything: the card it opens from
 * sits inside the sheet, under the top bar.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { legalBlocks, boldRuns } from '@/app/lib/legalBlocks';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

function Runs({ text }) {
  return boldRuns(text).map((run, i) => (run.bold ? <strong key={i} className="font-bold text-[var(--mc-ink)]">{run.text}</strong> : <span key={i}>{run.text}</span>));
}

function Block({ block }) {
  if (block.kind === 'list') {
    return (
      <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-[var(--mc-muted)]">
        {block.items.map((item, i) => (
          <li key={i}>
            <Runs text={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === 'rule') return <hr className="my-6 border-[var(--mc-line)]" />;
  if (block.kind === 'h1') {
    return (
      <h3 className="mt-8 text-[20px] font-bold leading-7 text-[var(--mc-ink)]">
        <Runs text={block.text} />
      </h3>
    );
  }
  if (block.kind === 'h2' || block.kind === 'h3') {
    return (
      <h4 className="mt-6 text-[17px] font-bold leading-6 text-[var(--mc-ink)]">
        <Runs text={block.text} />
      </h4>
    );
  }
  return (
    <p className="mt-2">
      <Runs text={block.text} />
    </p>
  );
}

export default function ReadSheet({ rules = [], waiver = null, onClose }) {
  const close = useRef(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  useEffect(() => {
    // Focus goes to the close button, and back to "Read them" when it shuts. Escape shuts it on a keyboard.
    const back = document.activeElement;
    close.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') shut.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (back && typeof back.focus === 'function') back.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  const blocks = legalBlocks(waiver?.content || '');
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="mc-read-title" className="mc-dark fixed inset-0 z-[900] flex flex-col bg-[var(--mc-surface)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="shrink-0 border-b border-[var(--mc-line)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[60px] w-full max-w-2xl items-center justify-between gap-3 px-4">
          <h2 id="mc-read-title" className="min-w-0 truncate text-[19px] font-bold leading-6 text-[var(--mc-ink)]">
            Safety rules and waiver
          </h2>
          <button ref={close} type="button" onClick={onClose} className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-3.5 text-[15px] font-bold leading-5 text-[var(--mc-ink)] ${FOCUS}`}>
            <X size={18} aria-hidden="true" />
            Close
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto w-full max-w-2xl px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 text-base font-medium leading-6 text-[var(--mc-soft)]">
          <h3 className="text-[20px] font-bold leading-7 text-[var(--mc-ink)]">Safety rules</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-[var(--mc-muted)]">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {blocks.length ? blocks.map((block, i) => <Block key={i} block={block} />) : <p className="mt-8">Loading the waiver.</p>}
          <button type="button" onClick={onClose} className={`mt-8 flex h-[54px] w-full items-center justify-center rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] text-[17px] font-bold leading-6 text-[var(--mc-ink)] ${FOCUS}`}>
            Close
          </button>
        </article>
      </div>
    </div>,
    document.body
  );
}
