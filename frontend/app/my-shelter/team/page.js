/**
 * Team: staff seats. Everyone here works the same roster with the
 * same records; access ends the moment a seat is revoked.
 */

import { requirePortal } from '../lib';
import ShelterTeam from '@/app/shelter/ShelterTeam';

export const dynamic = 'force-dynamic';

export default async function PortalTeam() {
  await requirePortal();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] leading-tight font-black text-midnight-900">Team</h1>
        <p className="text-[15px] text-midnight-500 mt-1">
          Invite staff and volunteers by email. Managers can invite; only the account
          owner can change a manager&rsquo;s seat.
        </p>
      </div>
      <ShelterTeam />
    </div>
  );
}
