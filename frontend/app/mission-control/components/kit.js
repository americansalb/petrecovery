'use client';

/**
 * The few pieces every search screen is made of.
 *
 * One yellow button to a screen, and it is the next step in the search:
 * <Primary>. Everything else is quiet. "I've seen Max" is <SeenButton>,
 * the same dark button with an orange eye in the same place on every
 * screen; it is never yellow and never moves. Red means lost and is
 * never a button.
 *
 * Colours come from the --mc-* variables (app/globals.css), so the same
 * pieces are dark on a phone and light on a desk.
 */
import Link from 'next/link';
import { Eye, Loader2, Phone } from 'lucide-react';
import { phoneTel, phoneWords } from '../lib/words';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mc-surface)]';

/** The small line over a title. Bold and in ordinary letters at 13px: small capitals at 11px were hard to read. */
export function Eyebrow({ children, className = '' }) {
  return <p className={`text-[13px] font-bold leading-[18px] text-[var(--mc-muted)] ${className}`}>{children}</p>;
}

export function Heading({ children, as: Tag = 'h1', className = '' }) {
  return <Tag className={`text-[22px] font-bold leading-7 tracking-[-0.01em] text-[var(--mc-ink)] ${className}`}>{children}</Tag>;
}

export function Lead({ children, className = '' }) {
  return <p className={`text-[17px] font-medium leading-6 text-[var(--mc-soft)] ${className}`}>{children}</p>;
}

/** A sentence someone needs, at a size they can read at arm's length. */
export function Note({ children, className = '' }) {
  return <p className={`text-sm font-medium leading-5 text-[var(--mc-soft)] ${className}`}>{children}</p>;
}

function Inner({ busy, icon: Icon, children }) {
  return (
    <>
      {busy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : Icon ? <Icon size={20} aria-hidden="true" /> : null}
      <span>{children}</span>
    </>
  );
}

const BUTTON = `flex h-[54px] w-full shrink-0 items-center justify-center gap-2.5 rounded-xl px-4 text-[17px] font-bold leading-6 transition active:scale-[0.99] disabled:opacity-60 ${FOCUS}`;

/** The one yellow button. `href` makes it a link (a phone call, directions); `newTab` opens it beside the search. */
export function Primary({ children, onClick, href, newTab = false, busy = false, disabled = false, icon, className = '' }) {
  const look = `${BUTTON} bg-gradient-to-b from-flash-300 to-flash-400 text-midnight-950 shadow-[0_6px_18px_rgba(250,204,21,0.22)] hover:from-flash-200 hover:to-flash-300 ${className}`;
  if (href) {
    return (
      <a href={href} onClick={onClick} className={look} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <Inner icon={icon}>{children}</Inner>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={look}>
      <Inner busy={busy} icon={icon}>{children}</Inner>
    </button>
  );
}

/** A second button: the same size, never yellow. */
export function Second({ children, onClick, href, busy = false, disabled = false, icon, className = '' }) {
  const look = `${BUTTON} border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] text-[var(--mc-ink)] hover:brightness-110 ${className}`;
  if (href) {
    const external = /^(tel:|sms:|mailto:|https?:)/.test(href);
    const Tag = external ? 'a' : Link;
    return (
      <Tag href={href} className={look}>
        <Inner icon={icon}>{children}</Inner>
      </Tag>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={look}>
      <Inner busy={busy} icon={icon}>{children}</Inner>
    </button>
  );
}

/** "I've seen Max": on every search screen, the same button in the same place. `label` words it for someone sending again. */
export function SeenButton({ name, onClick, label = null, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`${BUTTON} border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] text-[var(--mc-ink)] hover:brightness-110 ${className}`}>
      <Eye size={20} className="text-[var(--mc-seen)]" aria-hidden="true" />
      <span>{label || `I've seen ${name}`}</span>
    </button>
  );
}

/** An underlined way out or aside. Short words: it shares a row with the phone number. */
export function QuietLink({ children, onClick, href, className = '' }) {
  const look = `inline-flex min-h-[44px] items-center text-[15px] font-semibold leading-5 text-[var(--mc-ink)] underline underline-offset-4 ${FOCUS} ${className}`;
  if (href) {
    return (
      <Link href={href} className={look}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={look}>
      {children}
    </button>
  );
}

/** "Call Avery (512) 555-0100": the owner's number, where the pet's page already shows it. */
export function CallOwner({ owner, className = '' }) {
  if (!owner?.phone) return <span className={className} />;
  return (
    <a href={`tel:${phoneTel(owner.phone)}`} className={`inline-flex min-h-[44px] min-w-0 items-center gap-2 text-[15px] font-semibold leading-5 text-[var(--mc-soft)] ${FOCUS} ${className}`}>
      <Phone size={18} className="shrink-0" aria-hidden="true" />
      <span className="truncate">
        Call {owner.firstName || 'the owner'} {phoneWords(owner.phone)}
      </span>
    </a>
  );
}

/** The last row of a search screen: the owner's number on the left, the way out on the right. */
export function BottomRow({ owner, children }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <CallOwner owner={owner} />
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/**
 * Advice, with where it comes from above it. The lines are the site's own
 * (the searcher's brief, the owner's finder guide, the advice engine) and
 * are passed in whole; this only sets them.
 */
export function AdviceBlock({ source, lines = [], className = '' }) {
  const shown = lines.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {source && <Eyebrow>{source}</Eyebrow>}
      {shown.map((line) => (
        <p key={line} className="text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
          {line}
        </p>
      ))}
    </div>
  );
}

/** Words that something went wrong, where the person is looking. */
export function Problem({ children, className = '' }) {
  if (!children) return null;
  return (
    <p role="alert" className={`text-sm font-semibold leading-5 text-[var(--mc-danger)] ${className}`}>
      {children}
    </p>
  );
}

/** A stamp for the state of the pet: LOST in red, HOME in green with a check. Never a button. */
export function Stamp({ kind = 'lost' }) {
  const look = kind === 'home' ? 'bg-emerald-400 text-emerald-950' : kind === 'closed' ? 'bg-slate-500 text-white' : 'bg-red-600 text-white';
  const word = kind === 'home' ? 'Home' : kind === 'closed' ? 'Closed' : 'Lost';
  return (
    <span className={`inline-flex -rotate-2 items-center gap-1 rounded px-1.5 font-stamp text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.16em] ${look}`}>
      {kind === 'home' && <span aria-hidden="true">✓</span>}
      {word}
    </span>
  );
}
