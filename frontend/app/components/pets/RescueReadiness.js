'use client';

/**
 * Rescue readiness (direction D): one quiet line. A complete profile is a
 * pre-built rescue mission, but it must never feel like homework, so it
 * collapses to a single sentence, the count and the one next thing to add.
 * It disappears once the profile is complete.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

function readinessItems({ pet, photos, personality, shares, viewLinkUrl }) {
  const editHref = `/pets/${pet.id}/edit`;
  const shareHref = `/pets/${pet.id}/share`;
  const hasTeam = (Array.isArray(shares) && shares.some((s) => s.status === 'ACTIVE')) || !!viewLinkUrl;
  return [
    { id: 'photo', label: 'a clear photo', met: !!pet.primaryPhotoUrl, href: editHref },
    { id: 'marks', label: 'distinctive marks', met: !!pet.distinctiveMarks, href: editHref },
    { id: 'chip', label: 'a microchip number', met: !!pet.microchipId, href: editHref },
    { id: 'personality', label: 'behavior notes', met: personality.length > 0, href: editHref },
    { id: 'weight', label: 'a current weight', met: pet.weight != null, href: editHref },
    { id: 'photos2', label: 'backup photos', met: photos.length >= 2, href: editHref },
    { id: 'team', label: 'a care team or view link', met: hasTeam, href: shareHref },
  ];
}

export default function RescueReadiness({ pet, photos, personality, shares, viewLinkUrl, isOwner }) {
  const items = readinessItems({ pet, photos, personality, shares, viewLinkUrl });
  const met = items.filter((i) => i.met).length;
  const next = items.find((i) => !i.met);
  if (met === items.length || !next) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-care-tealWash px-4 py-3">
      <span className="text-[13px] font-semibold text-care-tealDark tabular-nums">{met}/{items.length}</span>
      <p className="text-[13px] text-care-teal flex-1 min-w-0">
        emergency details on file.
        {isOwner && next && (
          <>{' '}<Link href={next.href} className="inline-flex items-center gap-0.5 font-semibold text-care-tealDark hover:underline">Add {next.label}<ChevronRight size={12} /></Link></>
        )}
      </p>
    </div>
  );
}
