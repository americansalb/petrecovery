/**
 * /rasuwa/letter: the live families' letter on the families' own domain.
 * Mirrors the coordinating family's Google Doc (the letter to the
 * Secretary of State plus the list of the missing and their signers)
 * and re-renders every few minutes via ISR, so a link printed in a
 * letter or read over the phone (rescueourfamily.org/letter, redirected
 * in next.config.js) always shows the current document. When the doc
 * cannot be fetched, the page still links it directly.
 */

import Link from 'next/link';
import { buildShareMetadata } from '@/app/lib/shareMetadata';
import SignerCount from '../SignerCount';
import { fetchJointLetterText } from '../jointLetter';
import { JOINT_LETTER_DOC_URL } from '../letterData';

export const revalidate = 300;

export const metadata = buildShareMetadata({
  title: 'The families\' letter',
  description:
    'The live letter from the families of people missing in the August 26 Rasuwa flood in Nepal to the U.S. Secretary of State, with the list of the missing. Updated by the coordinating family as names are added.',
  image: '/rasuwa-share.png',
  imageAlt: 'Missing in the Rasuwa flood: write to your representatives. rescueourfamily.org',
  index: true,
});

export default async function JointLetterPage() {
  const paragraphs = await fetchJointLetterText();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold">The families&apos; letter</h1>
          <span className="flex gap-2">
            <Link
              href="/rasuwa/progress"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              The chart
            </Link>
            <Link
              href="/rasuwa/form"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              Sign it
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
          <SignerCount /> This page mirrors the live document the coordinating family keeps and
          refreshes every few minutes.{' '}
          <a className="underline" href={JOINT_LETTER_DOC_URL} target="_blank" rel="noopener noreferrer">
            Open the document on Google Docs
          </a>
          .
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {paragraphs ? (
          <article className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4 whitespace-pre-wrap leading-relaxed text-slate-800 last:mb-0">
                {p}
              </p>
            ))}
          </article>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700">
            <p>
              The letter could not be loaded here just now.{' '}
              <a className="underline" href={JOINT_LETTER_DOC_URL} target="_blank" rel="noopener noreferrer">
                Read the live document on Google Docs
              </a>
              ; it is the same letter this page mirrors.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
