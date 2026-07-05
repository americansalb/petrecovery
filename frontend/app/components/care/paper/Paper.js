'use client';

/**
 * The Paper Passport kit — the care product's physical world.
 *
 * The Health Book IS a book: cream paper with a faint dot grain, navy
 * ink, ruled lines, rubber stamps, a marker highlighter, polaroid
 * photos, index tabs. Every care surface renders through these
 * primitives so the whole product is one object you could hold.
 *
 * All presentational; zero data logic. Tokens live in tailwind.config
 * (paper / pen / stampred / stampgreen / marker, font-diary / font-stamp).
 */

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/components/ui';

/* ------------------------------ The ground ------------------------------- */

/** The desk the book sits on: paper ground with a faint dot grain. */
export function PaperScaffold({ children, className }) {
  return (
    <div
      className={cn('min-h-screen bg-paper-100 text-pen-900', className)}
      style={{
        backgroundImage: 'radial-gradient(rgba(35,42,61,0.05) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
      {children}
    </div>
  );
}

/** One sheet of the book. `perforated` draws a torn-edge dot column. */
export function Sheet({ children, className, perforated = false, as: Tag = 'section' }) {
  return (
    <Tag className={cn(
      'relative bg-paper-50 border border-paper-400 rounded-md shadow-[0_1px_0_rgba(35,42,61,0.06),0_10px_24px_-18px_rgba(35,42,61,0.45)]',
      perforated ? 'pl-8 pr-5 py-5' : 'px-5 py-5',
      className
    )}>
      {perforated && (
        <span
          aria-hidden="true"
          className="absolute left-3.5 top-2 bottom-2 w-[3px]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(35,42,61,0.25) 1.6px, transparent 1.9px)',
            backgroundSize: '3px 13px',
            backgroundRepeat: 'repeat-y',
          }}
        />
      )}
      {children}
    </Tag>
  );
}

/* ------------------------------- The voices ------------------------------ */

/** The diary voice: a serif italic page heading, with an optional aside. */
export function PageTitle({ children, aside, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 border-b-2 border-pen-900 pb-2.5', className)}>
      <h2 className="font-diary italic text-[23px] leading-tight tracking-tight text-pen-900">{children}</h2>
      {aside && <span className="font-stamp text-[10px] uppercase tracking-[0.16em] text-pen-400 whitespace-nowrap">{aside}</span>}
    </div>
  );
}

/** A quiet section heading in the diary hand ("the good stuff"). */
export function SectionInk({ children, action, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 mb-2.5', className)}>
      <h3 className="font-diary italic text-[16px] text-pen-600">{children}</h3>
      {action}
    </div>
  );
}

/* ---------------------------- Ruled journal ------------------------------ */

export function RuledList({ children, className }) {
  return <div className={cn('flex flex-col', className)}>{children}</div>;
}

/** One ruled line of the journal. */
export function RuledRow({ children, className, faded = false }) {
  return (
    <div className={cn(
      'flex items-center gap-3 py-3 border-b border-pen-900/[0.16] last:border-b-0',
      faded && 'opacity-60',
      className
    )}>
      {children}
    </div>
  );
}

/* --------------------------- Marks on the page --------------------------- */

/** The ink checkbox: done = an oversized hand-drawn tick escaping the box. */
export function InkCheckbox({ done, skipped }) {
  return (
    <span className={cn('relative w-5 h-5 border-2 rounded-[3px] shrink-0', skipped ? 'border-pen-300' : 'border-pen-900')} aria-hidden="true">
      {done && (
        <span className="absolute -top-[9px] left-0 text-[24px] leading-none font-bold text-stampgreen" style={{ transform: 'rotate(-8deg)' }}>
          ✓
        </span>
      )}
      {skipped && (
        <span className="absolute inset-0 flex items-center justify-center text-[13px] leading-none font-bold text-pen-300">✕</span>
      )}
    </span>
  );
}

/** A rubber stamp of state: GIVEN · 4:02 PM, VIEW ONLY, DUE SOON... */
export function StampText({ children, tone = 'green', rotate = -6, className, size = 'md' }) {
  const tones = {
    green: 'text-stampgreen border-stampgreen',
    red: 'text-stampred border-stampred',
    ink: 'text-pen-600 border-pen-400',
  };
  return (
    <span
      className={cn(
        'inline-block font-stamp uppercase border-2 rounded-[4px] opacity-90 whitespace-nowrap',
        size === 'sm' ? 'text-[8.5px] tracking-[0.1em] px-1.5 py-0.5' : 'text-[9.5px] tracking-[0.14em] px-2 py-[3px]',
        tones[tone] || tones.green,
        className
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** The action: a dashed red-ink pill. The one thing to press. */
export function GiveButton({ children = 'Give now', onClick, disabled, busy, ariaLabel, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={ariaLabel}
      className={cn(
        'font-stamp text-[10.5px] uppercase tracking-[0.12em] text-stampred',
        'border-[1.5px] border-dashed border-stampred rounded-[4px] px-3 py-2 bg-transparent',
        'hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors active:scale-95',
        'disabled:opacity-50 shrink-0',
        className
      )}
    >
      {busy ? '…' : children}
    </button>
  );
}

/** A small mono chip: a time, a count. `filled` = inked in. */
export function MonoChip({ children, filled, tone = 'ink', onClick, disabled, title, ariaLabel, className }) {
  const Tag = onClick ? 'button' : 'span';
  const palette = {
    ink: filled ? 'bg-pen-900 text-paper-50 border-pen-900' : 'border-pen-900 text-pen-900',
    green: filled ? 'bg-stampgreen text-paper-50 border-stampgreen' : 'border-stampgreen text-stampgreen',
    red: filled ? 'bg-stampred text-paper-50 border-stampred' : 'border-stampred text-stampred',
  };
  return (
    <Tag
      {...(onClick ? { onClick, disabled, type: 'button' } : {})}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 font-stamp text-[10px] tracking-[0.04em] px-2.5 py-1 border-[1.5px] rounded-full bg-transparent whitespace-nowrap',
        palette[tone] || palette.ink,
        onClick && !disabled && 'hover:bg-pen-900 hover:text-paper-50 transition-colors active:scale-95',
        disabled && 'opacity-50',
        className
      )}
    >
      {children}
    </Tag>
  );
}

/** The round passport stamp — vaccines, mostly. */
export function InkStampCircle({ over, title, under, tone = 'green', rotate = -7, onRemove, removeLabel, className }) {
  const tones = {
    green: 'text-stampgreen border-stampgreen',
    red: 'text-stampred border-stampred',
    ink: 'text-pen-400 border-pen-300',
  };
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn(
          'w-[86px] h-[86px] border-[2.5px] rounded-full flex flex-col items-center justify-center text-center gap-px opacity-90 bg-paper-50/40',
          tones[tone] || tones.green
        )}
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        {over && <small className="font-stamp text-[7.5px] uppercase tracking-[0.08em] leading-none">{over}</small>}
        <b className="text-[11.5px] leading-tight px-1">{title}</b>
        {under && <small className="font-stamp text-[7.5px] uppercase tracking-[0.06em] leading-none">{under}</small>}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={removeLabel}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-paper-50 border border-pen-400 text-pen-400 hover:text-stampred hover:border-stampred flex items-center justify-center text-xs"
        >
          ✕
        </button>
      )}
    </span>
  );
}

/* ------------------------------- Keepsakes ------------------------------- */

/** A photo taped into the book. */
export function Polaroid({ src, alt = '', fallback, caption, size = 'md', rotate = -3, className }) {
  const dims = { sm: 'w-14 h-14', md: 'w-20 h-20', lg: 'w-28 h-28' };
  return (
    <span className={cn('relative inline-block bg-white p-1 pb-4 shadow-[0_3px_10px_rgba(35,42,61,0.25)]', className)} style={{ transform: `rotate(${rotate}deg)` }}>
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-marker-wash/80 border border-paper-400/60 rotate-[2deg]"
        style={{ clipPath: 'polygon(2% 10%, 98% 0%, 100% 90%, 0% 100%)' }}
      />
      <span className={cn('block overflow-hidden bg-paper-200', dims[size] || dims.md)}>
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-pen-300">{fallback}</span>
        )}
      </span>
      {caption && <span className="absolute bottom-0.5 left-0 right-0 text-center font-diary italic text-[9px] text-pen-600 truncate px-1">{caption}</span>}
    </span>
  );
}

/** Progress as ink: n of m, written like a fraction in the margin. */
export function InkFraction({ given, due, label = 'doses' }) {
  const doneAll = due > 0 && given >= due;
  return (
    <span className="flex flex-col items-center justify-center w-[74px] h-[74px] rounded-full border-[2.5px] border-pen-900 shrink-0 bg-paper-50/60"
      role="img" aria-label={`${given} of ${due} ${label}`}
      style={{ transform: 'rotate(-4deg)' }}
    >
      <span className={cn('font-diary italic text-[22px] leading-none', doneAll ? 'text-stampgreen' : 'text-pen-900')}>
        {given}<span className="text-pen-400 text-[15px]">/{due}</span>
      </span>
      <span className="font-stamp text-[7.5px] uppercase tracking-[0.14em] text-pen-400 mt-0.5">{label}</span>
    </span>
  );
}

/* ------------------------------- Index tabs ------------------------------ */

/**
 * The hallway as physical index tabs sticking up from the page below.
 * Active tab = red; the others are paper edges.
 */
export function IndexTabs({ tabs, activeId, className }) {
  return (
    <nav className={cn('flex items-end gap-1.5 overflow-x-auto', className)} aria-label="Pet sections">
      {tabs.map(({ id, label, href }) => {
        const active = id === activeId;
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'font-stamp uppercase whitespace-nowrap rounded-t-md border border-b-0 transition-colors',
              active
                ? 'bg-stampred text-paper-50 border-stampred-dark text-[10.5px] tracking-[0.14em] px-4 pt-2.5 pb-2'
                : 'bg-paper-200 text-pen-600 border-paper-400 text-[10px] tracking-[0.12em] px-3.5 pt-2 pb-1.5 hover:bg-paper-300'
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** A red-ink margin note — the alert that must be read first. */
export function MarginNote({ children, href, label = 'Medical notes', className }) {
  if (!children) return null;
  const inner = (
    <>
      <span aria-hidden="true" className="w-[3px] self-stretch bg-stampred rounded-full shrink-0" />
      <span className="text-[13px] leading-snug text-stampred-dark min-w-0">
        <span className="font-stamp text-[9px] uppercase tracking-[0.14em] mr-2">{label}</span>
        <span className="font-diary italic">{children}</span>
      </span>
    </>
  );
  const cls = 'flex items-center gap-3 py-1.5 mb-4';
  if (!href) return <div className={cn(cls, className)}>{inner}</div>;
  return (
    <Link href={href} className={cn(cls, 'group', className)}>
      {inner}
      <span className="ml-auto font-stamp text-[9px] uppercase tracking-[0.12em] text-pen-400 group-hover:text-stampred shrink-0">edit →</span>
    </Link>
  );
}

/** Small hand-drawn tick for inline use. */
export function InkTick({ className }) {
  return <Check size={12} strokeWidth={3.5} className={cn('inline -mt-0.5', className)} />;
}
