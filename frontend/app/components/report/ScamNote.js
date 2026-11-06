/**
 * ScamNote - the warning every owner gets after posting, reward or not:
 * nobody pays before the pet is back in their hands. On the success
 * screen, in the owner's panel, and (as text) in the day-1 email.
 */

import { ShieldAlert } from 'lucide-react';
import { SCAM_WARNING } from '@/app/lib/caseDetails';

export default function ScamNote({ compact = false }) {
  return (
    <section aria-labelledby="scam-note-heading" className={`rounded-2xl border border-amber-300 bg-amber-50 text-left ${compact ? 'p-3.5' : 'p-4'}`}>
      <h2 id="scam-note-heading" className="flex items-center gap-2 text-sm font-extrabold text-midnight-900">
        <ShieldAlert size={18} className="text-amber-600" aria-hidden="true" />
        Watch for scams
      </h2>
      <ul className={`mt-2 space-y-1.5 text-midnight-800 ${compact ? 'text-[13px]' : 'text-sm'}`}>
        {SCAM_WARNING.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
