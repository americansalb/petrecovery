'use client';

/**
 * The top of every search screen: who this is about, and where the
 * search stands, in one sentence that is always current. A fresh sighting
 * turns the sentence orange on every screen at once.
 *
 * The arrow on the left is the way back out to the pet's page: this
 * screen takes the whole window (app/lib/navChrome.js), and a takeover
 * has to ship its own way out.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Stamp } from './kit';
import { petSub } from '../lib/words';

export default function TopBar({ picture, line, backHref, onPhoto, right = null, wide = false }) {
  const pet = picture.pet || {};
  const name = pet.name || 'Lost pet';
  const seen = line.tone === 'seen';
  const stamp = picture.reunited ? 'home' : picture.open ? 'lost' : 'closed';
  // Whose and what colour: the breed is on the photo and the sighting screen, and does not fit beside the button here.
  const sub = petSub({ owner: picture.owner?.firstName, species: pet.species, color: pet.color, breed: wide ? pet.breed : '' });
  return (
    <header
      className={`relative z-[500] shrink-0 border-b border-[var(--mc-line)] ${seen ? `bg-[var(--mc-seen-bg)] ${wide ? 'lg:bg-[var(--mc-surface)]' : ''}` : 'bg-[var(--mc-surface)]'} pt-[env(safe-area-inset-top)]`}
    >
      <div className={`flex items-center gap-2 px-2 ${wide ? 'h-16 lg:px-4' : 'h-[60px]'}`}>
        <Link
          href={backHref}
          aria-label={`Back to ${name}'s page`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onPhoto}
          disabled={!pet.photoUrl}
          aria-label={pet.photoUrl ? `See ${name}'s photo` : undefined}
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--mc-raised)] ring-1 ring-[var(--mc-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
        >
          {pet.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-base font-bold text-[var(--mc-muted)]" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <div className={`min-w-0 ${wide ? 'lg:flex-none' : ''} flex-1`}>
          <p className="flex items-center gap-2">
            <span className="truncate text-[19px] font-bold leading-6 text-[var(--mc-ink)]">{name}</span>
            <Stamp kind={stamp} />
          </p>
          <p className="truncate text-[13px] font-medium leading-[18px] text-[var(--mc-soft)]">{sub}</p>
        </div>
        {wide && (
          <p className={`hidden min-w-0 flex-1 truncate pl-6 text-[17px] font-bold leading-6 lg:block ${seen ? 'text-[var(--mc-seen-ink)]' : 'text-[var(--mc-ink)]'}`} aria-live="polite">
            <span className={`mr-2.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${seen ? 'bg-[var(--mc-seen)]' : 'bg-red-600'}`} aria-hidden="true" />
            {line.text}
          </p>
        )}
        {right}
        {!wide && pet.photoUrl && (
          <button
            type="button"
            onClick={onPhoto}
            className="shrink-0 rounded-xl border border-[var(--mc-line-strong)] px-2 py-2 text-[13px] font-bold leading-4 text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
          >
            See photo
          </button>
        )}
      </div>
      <p
        className={`px-4 pb-3 text-[17px] font-semibold leading-6 ${wide ? 'lg:hidden' : ''} ${seen ? 'text-[var(--mc-seen)]' : 'text-[var(--mc-ink)]'}`}
        aria-live="polite"
      >
        {seen && <span className="mr-2 inline-block h-3 w-3 rounded-full bg-[var(--mc-seen)] align-baseline" aria-hidden="true" />}
        {line.text}
      </p>
    </header>
  );
}
