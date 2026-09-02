/**
 * /rasuwa/correction: ask the coordinating families to review a
 * mistake in a missing person's details. Linked from the wizard's
 * person step, the sign page, the letter page, and the progress
 * chart; requests land on the task force board, the families fix the
 * letter document at its source, and the site follows it.
 */

import Link from 'next/link';
import { buildShareMetadata } from '@/app/lib/shareMetadata';
import CorrectionForm from './CorrectionForm';

export const metadata = buildShareMetadata({
  title: 'Report a mistake in the details',
  description:
    'Spotted something wrong in a missing person\'s details on the families\' letter for the Rasuwa flood? Ask the coordinating families to review it.',
  image: '/rasuwa-share.png',
  imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
  index: true,
});

export default function CorrectionPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Report a mistake</h1>
          <span className="flex gap-2">
            <Link
              href="/rasuwa/letter"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Read the letter
            </Link>
            <Link
              href="/rasuwa"
              className="shrink-0 rounded-md bg-blue-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-900"
            >
              Write to Congress
            </Link>
          </span>
        </div>
        <p className="mx-auto mt-2 w-full max-w-3xl text-sm text-slate-600">
          A wrong spelling, location, or tour group in a missing person&apos;s details can slow a
          search. Say what is wrong below; the coordinating families review every request and
          correct the letter at its source.
        </p>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <CorrectionForm />
      </main>
    </div>
  );
}
