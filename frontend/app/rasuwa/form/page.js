/**
 * /rasuwa/form: shows the coalition's Google roster form inside the
 * families' own domain (rescueourfamily.org/form via host rewrite) so
 * visitors never land on a raw script.google.com URL. The form itself
 * is unchanged and keeps collecting to the same spreadsheet; paste its
 * URL into ROSTER_FORM_URL in ../letterData.js to turn this page on.
 *
 * A plain Google Form embeds as-is. An Apps Script web app must be
 * deployed with HtmlService.XFrameOptionsMode.ALLOWALL or the iframe
 * stays blank; the fallback link above the frame covers that case.
 */

import Link from 'next/link';
import { ROSTER_FORM_URL } from '../letterData';

export const metadata = { title: 'Family roster form' };

export default function RosterFormPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <h1 className="text-lg font-bold">Family roster form</h1>
          <Link href="/rasuwa" className="text-sm font-semibold text-blue-800 underline">
            Write to Congress
          </Link>
        </div>
      </header>
      {ROSTER_FORM_URL ? (
        <div className="mx-auto w-full max-w-3xl flex-1 sm:px-4 sm:py-4">
          <p className="px-4 py-2 text-sm text-slate-600 sm:px-0">
            If the form does not load below,{' '}
            <a className="underline" href={ROSTER_FORM_URL} target="_blank" rel="noopener noreferrer">
              open it in its own tab
            </a>.
          </p>
          <iframe
            src={ROSTER_FORM_URL}
            title="Family roster form"
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
