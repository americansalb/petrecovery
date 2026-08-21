/**
 * Where an unsubscribe link lands.
 *
 * /api/unsubscribe/:token redirected here after doing the work, and this
 * page did not exist, so anyone who unsubscribed got a 404 and no way to
 * tell whether it had worked.
 */

import Link from 'next/link';
import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Unsubscribed | ReunitePets',
  description: 'You have been unsubscribed from ReunitePets emails.',
  index: false,
});

const WHAT_STOPPED = {
  all: 'You will not get case updates, sighting alerts, squad messages or the digest.',
  case_updates: 'You will not get updates about your cases.',
  sighting_alerts: 'You will not get sighting alerts.',
  squad_messages: 'You will not get messages from rescue forces.',
  weekly_digest: 'You will not get the digest.',
  marketing: 'You will not get product emails.',
};

export default function UnsubscribeSuccessPage({ searchParams }) {
  const type = searchParams?.type || 'all';
  const detail = WHAT_STOPPED[type] || WHAT_STOPPED.all;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">You are unsubscribed</h1>
        <p className="mt-3 text-slate-600">{detail}</p>
        <p className="mt-3 text-slate-600">
          You will still get the emails we have to send you, like a password
          reset you asked for, or a message about a pet you reported.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            Choose what you get instead
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline"
          >
            Go to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}
