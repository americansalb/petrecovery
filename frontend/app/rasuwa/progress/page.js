/**
 * /rasuwa/progress: the public chart of the letter campaign. Every
 * missing person, the letters on record for them, and how many people
 * have said they will write, refreshed each minute. Public and
 * shareable on purpose: families see their progress and pick up the
 * people with nobody yet. Team members' names stay behind the board's
 * code; this page shows counts only.
 */

import Link from 'next/link';
import { buildShareMetadata } from '@/app/lib/shareMetadata';
import SignerCount from '../SignerCount';
import ProgressChart from './ProgressChart';

export const metadata = buildShareMetadata({
  title: 'Letters for every person',
  description:
    'The chart of the Rasuwa flood letter campaign: every missing person and the letters written to governments for them. Pick someone with nobody yet and write in ten minutes.',
  image: '/rasuwa-share.png',
  imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
  index: true,
});

export default function ProgressPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Letters for every person</h1>
          <span className="flex gap-2">
            <Link
              href="/rasuwa/letter"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              The families&apos; letter
            </Link>
            <Link
              href="/rasuwa"
              className="shrink-0 rounded-md bg-blue-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-900"
            >
              Write to your representatives
            </Link>
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm text-slate-600">
          <SignerCount /> Every missing person deserves letters pressing their government. This
          chart updates as letters are written.
        </p>
        <div className="mt-6">
          <ProgressChart />
        </div>
      </main>
    </div>
  );
}
