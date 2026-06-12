'use client';

/**
 * Rescue Readiness - the profile's spine (PET_PROFILE_DESIGN.md §5)
 *
 * A complete profile is a pre-built rescue mission. This meter scores
 * how mission-ready the record is and turns every gap into a one-tap
 * fix, framed as protection, never homework: "If Max ever slipped
 * out, here's what the search party would already know."
 *
 * It is also the day-one guide: a brand-new profile's next step is
 * always the top unmet item, so the Overview never feels empty.
 */

import Link from 'next/link';
import { ShieldCheck, Check, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card, cn } from '@/components/ui';

function readinessItems({ pet, photos, personality, shares, viewLinkUrl }) {
  const editHref = `/pets/${pet.id}/edit`;
  const shareHref = `/pets/${pet.id}/share`;
  const hasTeam =
    (Array.isArray(shares) && shares.some((s) => s.status === 'ACTIVE')) || !!viewLinkUrl;

  return [
    {
      id: 'photo',
      label: 'A clear photo',
      hint: 'becomes the flyer',
      met: !!pet.primaryPhotoUrl,
      href: editHref,
    },
    {
      id: 'photos2',
      label: 'Backup photos',
      hint: 'different angles help searchers',
      met: photos.length >= 2,
      href: editHref,
    },
    {
      id: 'marks',
      label: 'Distinctive marks',
      hint: 'how a stranger tells them apart',
      met: !!pet.distinctiveMarks,
      href: editHref,
    },
    {
      id: 'chip',
      label: 'Microchip on file',
      hint: 'verification when found',
      met: !!pet.microchipId,
      href: editHref,
    },
    {
      id: 'personality',
      label: 'Behavior notes',
      hint: '"shy — do not chase" changes a search',
      met: personality.length > 0,
      href: editHref,
    },
    {
      id: 'weight',
      label: 'Current weight',
      hint: 'tunes the search radius',
      met: pet.weight != null,
      href: editHref,
    },
    {
      id: 'team',
      label: 'A care team or view link',
      hint: 'people who already love this pet',
      met: hasTeam,
      href: shareHref,
    },
  ];
}

function MeterRing({ met, total }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? met / total : 0;
  return (
    <div className="relative w-[72px] h-[72px] shrink-0" role="img" aria-label={`Search-party ready: ${met} of ${total}`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-midnight-100" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn('transition-all duration-700', pct >= 1 ? 'stroke-emerald-400' : 'stroke-flash-400')}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-midnight-900 tabular-nums">
        {met}/{total}
      </span>
    </div>
  );
}

export default function RescueReadiness({ pet, photos, personality, shares, viewLinkUrl, isOwner }) {
  const items = readinessItems({ pet, photos, personality, shares, viewLinkUrl });
  const met = items.filter((i) => i.met).length;
  const ready = met === items.length;

  return (
    <Card padding="lg" className={cn('mb-6', ready && 'border-emerald-200 bg-emerald-50/40')}>
      <div className="flex items-center gap-4">
        <MeterRing met={met} total={items.length} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-bold text-midnight-900">
            <ShieldCheck size={18} className={ready ? 'text-emerald-500' : 'text-midnight-400'} />
            {ready ? 'Search-party ready' : 'Rescue readiness'}
          </h2>
          <p className="text-sm text-midnight-500 mt-0.5">
            {ready
              ? `If ${pet.name} ever slipped out, the search party already knows everything it needs.`
              : `If ${pet.name} ever slipped out, here's what the search party would already know.`}
          </p>
        </div>
      </div>

      {!ready && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4">
          {items.map((item) =>
            item.met ? (
              <li key={item.id} className="flex items-center gap-2 py-1 text-sm text-midnight-400">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>{item.label}</span>
              </li>
            ) : (
              <li key={item.id}>
                {isOwner ? (
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2 py-1 text-sm font-semibold text-midnight-800 hover:text-midnight-950"
                  >
                    <span className="w-5 h-5 rounded-full border-2 border-midnight-200 group-hover:border-flash-400 transition-colors shrink-0" />
                    <span className="min-w-0 truncate">
                      {item.label}
                      <span className="font-normal text-midnight-400"> · {item.hint}</span>
                    </span>
                    <ChevronRight size={14} className="text-midnight-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-auto" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 py-1 text-sm text-midnight-500">
                    <span className="w-5 h-5 rounded-full border-2 border-midnight-200 shrink-0" />
                    {item.label}
                  </span>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {isOwner && (
        <p className="mt-4 pt-3 border-t border-midnight-100 text-xs text-midnight-400">
          <AlertTriangle size={12} className="inline -mt-0.5 mr-1.5" />
          <span>
            Is {pet.name} missing right now?{' '}
            <Link href={`/report/new?petId=${pet.id}`} className="font-bold text-midnight-600 hover:text-red-600 underline underline-offset-2">
              Start a search
            </Link>
          </span>
        </p>
      )}
    </Card>
  );
}
