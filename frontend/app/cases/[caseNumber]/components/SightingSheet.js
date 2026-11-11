'use client';

/**
 * "I've seen this pet": call the owner when the pet is in sight, or send
 * the sighting. The search screen takes it from anyone, with no account:
 * one tap sends where they are, and a sighting from earlier is typed in
 * by street (app/mission-control, steps/Witness.js).
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
              {`One tap sends where you are, if you see ${name} now. No account needed.`}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-midnight-400" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 rounded-xl bg-midnight-50 p-4">
        <p className="text-sm font-semibold text-midnight-900">If you see {name} again</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-midnight-600">
          <li>Don&apos;t chase or call out. A scared pet may run.</li>
          <li>Note the time, the place and which way they went.</li>
          <li>Take a photo if you can, even from far away.</li>
        </ul>
      </div>
    </Modal>
  );
}
