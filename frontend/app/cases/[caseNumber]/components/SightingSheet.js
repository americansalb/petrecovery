'use client';

/**
 * "I've seen this pet": call the owner when the pet is in sight, or send
 * the sighting. The search screen takes it from anyone, with no account:
 * one form, where and when (app/mission-control, steps/Witness.js).
 *
 * No advice is written here. How to behave near this pet is the owner's
 * own answer, which the pet's page shows above ("If you see Max") and the
 * search screen shows once the sighting is sent. A list here once told
 * people not to call out to a pet whose owner had just said "say the
 * name", and to note things the form has no place for.
 */

import Link from 'next/link';
import { Phone, MapPin, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui';

export default function SightingSheet({ open, onClose, name, phone, contactName, reportHref }) {
  return (
    <Modal open={open} onClose={onClose} title={`You've seen ${name}?`} subtitle="Thank you. Here is how to let the owner know.">
      <div className="space-y-2">
        {phone && (
          <a
            href={`tel:${phone.tel}`}
            className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Phone size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-midnight-900">Call the owner now</span>
              <span className="block text-sm text-midnight-600">
                Best if you can see {name} right now. {contactName ? `${contactName}, ` : ''}{phone.display}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-midnight-400" aria-hidden="true" />
          </a>
        )}

        <Link
          href={reportHref}
          className="flex items-center gap-3 rounded-xl bg-flash-50 p-4 ring-1 ring-flash-300 transition hover:bg-flash-100"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flash-400 text-midnight-900">
            <MapPin size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-midnight-900">Report the sighting</span>
            <span className="block text-sm text-midnight-600">
              Mark where and when. No account needed.
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-midnight-400" aria-hidden="true" />
        </Link>
      </div>
    </Modal>
  );
}
