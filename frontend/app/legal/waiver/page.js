import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LIABILITY_WAIVER_DOC } from '@/prisma/legal/liability-waiver';
import { legalBlocks, boldRuns } from '@/app/lib/legalBlocks';

/**
 * The Liability Waiver, readable by anyone.
 *
 * The sign-up forms ask people to agree to it (the register wizard and the
 * join form on a Rescue Force's page), and both used to link to
 * /legal/consent, which sends anyone signed out to the sign-in page. So a
 * visitor could not read what they were agreeing to.
 *
 * The text is prisma/legal/liability-waiver.js, the file boot syncs into
 * the database (prisma/sync-legal-docs.js), so this page and the accepted
 * version are the same document. Its markdown uses only headings, lists,
 * bold and rules, read by app/lib/legalBlocks.js (as the join card on a
 * search reads it) and rendered here as elements: no HTML is injected.
 */

export const metadata = {
  title: 'Liability Waiver - ReunitePets.org',
  description: 'The waiver people agree to before joining a Rescue Force or taking part in a search.',
};

/** "**bold** text" -> text with <strong> runs. */
function inline(text, keyPrefix) {
  return boldRuns(text).map((run, i) =>
    run.bold ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-midnight-900">
        {run.text}
      </strong>
    ) : (
      run.text
    )
  );
}

function renderDocument(content) {
  return legalBlocks(content).map((block, n) => {
    if (block.kind === 'list') {
      return (
        <ul key={`ul-${n}`} className="my-3 list-disc space-y-1.5 pl-6 text-midnight-700">
          {block.items.map((item, i) => (
            <li key={`li-${n}-${i}`}>{inline(item, `li-${n}-${i}`)}</li>
          ))}
        </ul>
      );
    }
    if (block.kind === 'rule') return <hr key={`hr-${n}`} className="my-8 border-midnight-200" />;
    if (block.kind === 'h3') {
      return (
        <h3 key={`h3-${n}`} className="mt-5 text-lg font-semibold text-midnight-900">
          {inline(block.text, `h3-${n}`)}
        </h3>
      );
    }
    if (block.kind === 'h2') {
      return (
        <h2 key={`h2-${n}`} className="mt-9 text-xl font-bold text-midnight-900 md:text-2xl">
          {inline(block.text, `h2-${n}`)}
        </h2>
      );
    }
    // The page heading already carries the title.
    if (block.kind === 'h1') return null;
    return (
      <p key={`p-${n}`} className="my-3 leading-relaxed text-midnight-700">
        {inline(block.text, `p-${n}`)}
      </p>
    );
  });
}

export default function WaiverPage() {
  return (
    <div className="min-h-screen bg-white">
      <article className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-midnight-900 md:text-4xl">{LIABILITY_WAIVER_DOC.title}</h1>
        <p className="mt-2 text-midnight-500">Version {LIABILITY_WAIVER_DOC.version}</p>
        <div className="mt-6">{renderDocument(LIABILITY_WAIVER_DOC.content)}</div>
        <p className="mt-10 text-midnight-700">
          See also the{' '}
          <Link href="/legal/terms" className="font-semibold text-midnight-900 underline hover:text-flash-600">
            Terms of Service
          </Link>{' '}
          and the{' '}
          <Link href="/privacy" className="font-semibold text-midnight-900 underline hover:text-flash-600">
            Privacy Policy
          </Link>
          .
        </p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 font-medium text-midnight-600 hover:text-midnight-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
        </Link>
      </article>
    </div>
  );
}
