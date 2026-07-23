/**
 * Your page: the shelter's public web presence, edited here, live at
 * /shelters/[id] (and later at the Pro subdomain).
 */

import { requirePortal } from '../lib';
import ShelterProfileEditor from '@/app/shelter/ShelterProfileEditor';

export const dynamic = 'force-dynamic';

export default async function PortalSite() {
  const { shelter } = await requirePortal();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-midnight-900">Your page</h1>
        <p className="text-midnight-500">
          A public page for {shelter.name}: adoptable animals, contact info, your
          story. No website needed; edits go live immediately.
        </p>
      </div>
      <ShelterProfileEditor shelterId={shelter.id} hideHeading />
    </div>
  );
}
