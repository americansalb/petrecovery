'use client';

/**
 * Rescue Readiness - one calm line, one next step
 *
 * A complete profile is a pre-built rescue mission, but the meter must
 * never feel like homework: collapsed it is a single strip — the ring,
 * the count, THE one next thing to add. The full checklist lives
 * behind "All 7", for the people who want to finish the job.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, cn } from '@/components/ui';

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

function Ring({ met, total, size = 44 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? met / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Rescue ready: ${met} of ${total}`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-midnight-100" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn('transition-all duration-700', pct >= 1 ? 'stroke-emerald-400' : 'stroke-flash-400')}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-midnight-900 tabular-nums">
        {met}/{total}
      </span>
    </div>
  );
}

export default function RescueReadiness({ pet, photos, personality, shares, viewLinkUrl, isOwner }) {
  const [open, setOpen] = useState(false);
  const items = readinessItems({ pet, photos, personality, shares, viewLinkUrl });
  const met = items.filter((i) => i.met).length;
  const ready = met === items.length;
  const next = items.find((i) => !i.met);

  if (ready) {
    return (
      <Card padding="lg" className="mb-3 border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-4">
          <Ring met={met} total={items.length} />
          <div className="min-w-0">
            <p className="font-bold text-midnight-900">Search-party ready</p>
            <p className="text-sm text-midnight-500">
              If {pet.name} ever slipped out, searchers would already know everything they need.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="mb-3">
      <div className="flex items-center gap-4">
        <Ring met={met} total={items.length} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-midnight-900">Rescue ready</p>
          <p className="text-sm text-midnight-500 truncate">
            What searchers would know if {pet.name} ever slipped out.
          </p>
        </div>
        {isOwner && next && (
          <Link
            href={next.href}
            className="hidden sm:inline-flex items-center gap-1 shrink-0 px-3.5 py-2 rounded-xl bg-flash-400 hover:bg-flash-300 text-midnight-900 text-sm font-bold transition-colors"
          >
            Add {next.label.toLowerCase()}
            <ChevronRight size={15} />
          </Link>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-midnight-400 hover:text-midnight-700 transition-colors"
        >
          All {items.length}
          <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {isOwner && next && (
        <Link
          href={next.href}
          className="sm:hidden mt-3 inline-flex w-full items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl bg-flash-400 text-midnight-900 text-sm font-bold"
        >
          Add {next.label.toLowerCase()}
          <ChevronRight size={15} />
        </Link>
      )}

      {open && (
        <ul className="mt-4 pt-3 border-t border-midnight-100 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              {item.met ? (
                <span className="flex items-center gap-2.5 py-1 text-sm text-midnight-400">
                  <Check size={15} strokeWidth={3} className="text-emerald-500 shrink-0" />
                  {item.label}
                </span>
              ) : isOwner ? (
                <Link href={item.href} className="group flex items-center gap-2.5 py-1 text-sm font-semibold text-midnight-800 hover:text-midnight-950">
                  <span className="w-[15px] h-[15px] rounded-full border-2 border-midnight-200 group-hover:border-flash-400 shrink-0 transition-colors" />
                  {item.label}
                  <ChevronRight size={14} className="text-midnight-300 ml-auto" />
                </Link>
              ) : (
                <span className="flex items-center gap-2.5 py-1 text-sm text-midnight-500">
                  <span className="w-[15px] h-[15px] rounded-full border-2 border-midnight-200 shrink-0" />
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
