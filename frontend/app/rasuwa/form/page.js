/**
 * /rasuwa/form: shows the coalition's Google roster form inside the
 * families' own domain (rescueourfamily.org redirects its root and /form
 * here) so visitors never land on a raw script.google.com URL. The form
 * itself is unchanged and keeps collecting to the same spreadsheet;
 * paste its URL into ROSTER_FORM_URL in ../letterData.js to turn this
 * page on.
 *
 * A plain Google Form embeds as-is and scales to any number of signers.
 * An Apps Script web app must be deployed with
 * HtmlService.XFrameOptionsMode.ALLOWALL or the iframe stays blank, and
 * Google caps such apps at 30 simultaneous executions, so a burst of
 * signers can see a Google error inside the frame. Both are why the
 * open-in-its-own-tab fallback stays prominent, and why organizers
 * should prefer a plain Google Form here when they can.
 *
 * This page is the front door of rescueourfamily.org: it has its own
 * share card, and it says what the letter is before asking for a name.
 */

import Link from 'next/link';
import { buildShareMetadata } from '@/app/lib/shareMetadata';
import { ROSTER_FORM_URL } from '../letterData';
import SignerCount from '../SignerCount';

export const metadata = buildShareMetadata({
  title: 'Sign the families\' letter',
  description:
    'For families of people missing in the August 26 Rasuwa flood in Nepal. Add your name and your missing family member to the families\' joint letter, then write to your own representatives.',
  image: '/rasuwa-share.png',
  imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
  index: true,
});

export default function RosterFormPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Sign the families&apos; letter</h1>
          <span className="flex gap-2">
            <Link
              href="/rasuwa/progress"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              The chart
            </Link>
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
          <SignerCount /> The letter asks for seven rescue actions; it was delivered on
          August 29 and keeps gathering names. The form below, kept by the coordinating
          family, adds your name and your missing family member to the letter. It takes about
          a minute. Then press Write to Congress to send your own letters to your senators
          and representative.
        </p>
      </header>
      {ROSTER_FORM_URL ? (
        <div className="mx-auto w-full max-w-3xl flex-1 sm:px-4 sm:py-4">
          <p className="px-4 py-3 text-sm text-slate-700 sm:px-0">
            If the form does not load below, or shows an error,{' '}
            <a
              className="font-semibold text-blue-800 underline"
              href={ROSTER_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              open the form in its own tab
            </a>{' '}
            and sign there. Same form, same letter.
          </p>
          <iframe
            src={ROSTER_FORM_URL}
            title="Sign the families' letter"
            className="h-[85vh] w-full border-0 bg-white sm:rounded-lg sm:border sm:border-slate-200"
          />
        </div>
      ) : (
        <p className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-700">
          The roster form is not linked yet. An organizer sets ROSTER_FORM_URL in
          app/rasuwa/letterData.js and this page shows it.
        </p>
      )}
    </div>
  );
}
