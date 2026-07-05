'use client';

/**
 * Rescue Readiness - one calm line, one next step
 *
 * A complete book is a pre-built rescue mission, but the meter must
 * never feel like homework: collapsed it is a single written line —
 * the count, THE one next thing to add. The full checklist lives
 * behind "all 7", for the people who want to finish the job.
 * Paper Passport register: an ink checklist inside the book.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui';
import { Sheet, InkCheckbox, StampText } from '@/app/components/care/paper/Paper';

function readinessItems({ pet, photos, personality, shares, viewLinkUrl }) {
  const editHref = `/pets/${pet.id}/edit`;
  const shareHref = `/pets/${pet.id}/share`;
  const hasTeam =
    (Array.isArray(shares) && shares.some((s) => s.status === 'ACTIVE')) || !!viewLinkUrl;

  return [
    { id: 'photo', label: 'A clear photo', met: !!pet.primaryPhotoUrl, href: editHref },
    { id: 'marks', label: 'Distinctive marks', met: !!pet.distinctiveMarks, href: editHref },
    { id: 'chip', label: 'Microchip', met: !!pet.microchipId, href: editHref },
    { id: 'personality', label: 'Behavior notes', met: personality.length > 0, href: editHref },
    { id: 'weight', label: 'Current weight', met: pet.weight != null, href: editHref },
    { id: 'photos2', label: 'Backup photos', met: photos.length >= 2, href: editHref },
    { id: 'team', label: 'A care team or view link', met: hasTeam, href: shareHref },
  ];
}

export default function RescueReadiness({ pet, photos, personality, shares, viewLinkUrl, isOwner }) {
  const [open, setOpen] = useState(false);
  const items = readinessItems({ pet, photos, personality, shares, viewLinkUrl });
  const met = items.filter((i) => i.met).length;
  const ready = met === items.length;
  const next = items.find((i) => !i.met);

  if (ready) {
    return (
      <Sheet className="mb-4">
        <div className="flex items-center gap-4">
          <StampText tone="green" rotate={-5}>Search-party ready</StampText>
          <p className="font-diary italic text-[13px] text-pen-400 min-w-0">
            if {pet.name} ever slipped out, searchers would already know everything they need.
          </p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet className="mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-diary italic text-[22px] leading-none text-pen-900 tabular-nums shrink-0" role="img" aria-label={`Rescue ready: ${met} of ${items.length}`}>
          {met}<span className="text-[14px] text-pen-400">/{items.length}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400">Rescue ready</p>
          <p className="font-diary italic text-[13px] text-pen-600 truncate">
            what searchers would know if {pet.name} ever slipped out.
          </p>
        </div>
        {isOwner && next && (
          <Link
            href={next.href}
            className="hidden sm:inline-flex items-center gap-1 shrink-0 font-stamp text-[10px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-3 py-2 hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors"
          >
            Add {next.label.toLowerCase()}
            <ChevronRight size={13} />
          </Link>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 inline-flex items-center gap-1 font-stamp text-[9.5px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 transition-colors"
        >
          all {items.length}
          <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {isOwner && next && (
        <Link
          href={next.href}
          className="sm:hidden mt-3 inline-flex w-full items-center justify-center gap-1 font-stamp text-[10px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-3 py-2.5"
        >
          Add {next.label.toLowerCase()}
          <ChevronRight size={13} />
        </Link>
      )}

      {open && (
        <ul className="mt-4 pt-3 border-t border-pen-900/[0.16] space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              {item.met ? (
                <span className="flex items-center gap-3 py-1.5 text-sm text-pen-400">
                  <InkCheckbox done />
                  {item.label}
                </span>
              ) : isOwner ? (
                <Link href={item.href} className="group flex items-center gap-3 py-1.5 text-sm font-semibold text-pen-900 hover:text-stampred">
                  <InkCheckbox />
                  {item.label}
                  <ChevronRight size={13} className="text-pen-300 ml-auto" />
                </Link>
              ) : (
                <span className="flex items-center gap-3 py-1.5 text-sm text-pen-600">
                  <InkCheckbox />
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
