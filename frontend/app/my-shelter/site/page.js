/**
 * Your page: the shelter's public web presence, edited here, live at
 * /shelters/[id] (and later at the Pro subdomain). The header line is
 * the page's live state, not marketing copy.
 */

import prisma from '@/app/lib/prisma';
import { requirePortal } from '../lib';
import ShelterProfileEditor from '@/app/shelter/ShelterProfileEditor';

export const dynamic = 'force-dynamic';

export default async function PortalSite() {
  const { shelter } = await requirePortal();

  const showing = await prisma.pet.count({
    where: {
      managedByShelterId: shelter.id,
      isDeleted: false,
      shelterStatus: { in: ['AVAILABLE', 'ADOPTION_PENDING'] },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] leading-tight font-black text-midnight-900">Your page</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-midnight-500 mt-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-midnight-700">
            <i className={`w-1.5 h-1.5 rounded-full ${shelter.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {shelter.isActive ? 'Live' : 'Pending activation'}
          </span>
          <span aria-hidden="true">·</span>
          <span>reunitepets.org/shelters/{shelter.id.slice(0, 8)}…</span>
          <span aria-hidden="true">·</span>
          <span>
            {showing === 0
              ? 'no animals showing yet'
              : `${showing} ${showing === 1 ? 'animal' : 'animals'} showing`}
          </span>
        </p>
      </div>

      <ShelterProfileEditor shelterId={shelter.id} hideHeading />

      <p className="text-[12px] leading-relaxed text-midnight-400">
        Edits go live immediately. Animals marked Available or Adoption pending
        appear on the page automatically; no website needed.
      </p>
    </div>
  );
}
