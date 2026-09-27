/**
 * The mark before a pet's status word: a dot in the pet's color, or a
 * green circle with a check when the pet is home (the check is what tells
 * home from lost for someone who cannot tell red from green).
 * `status` is a caseStatus() key, or `seen`. See app/lib/petColors.js.
 */

import { Check } from 'lucide-react';
import { PET_BG } from '@/app/lib/petColors';

export default function PetStatusDot({ status }) {
  if (status === 'home') {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
        <Check className="h-2.5 w-2.5" strokeWidth={4} />
      </span>
    );
  }
  return <span className={`h-2 w-2 shrink-0 rounded-full ${PET_BG[status] || PET_BG.closed}`} aria-hidden="true" />;
}
