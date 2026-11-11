'use client';

/**
 * Sends someone who opened a pet's share link on to its search screen,
 * keeping `?action=sighting` when the link carried it. The screen takes
 * the whole window, so this page shows only a moment of waiting under the
 * site's bar, with a link in case the redirect does not run.
 */
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function JoinRedirect() {
  const { missionId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const action = search.get('action');
  const href = `/mission-control?mission=${encodeURIComponent(missionId)}${action ? `&action=${encodeURIComponent(action)}` : ''}`;

  useEffect(() => {
    router.replace(href);
  }, [router, href]);

  return (
    // The site's layout already wraps every page in <main>.
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center bg-midnight-950 px-5 text-center">
      <Loader2 className="h-9 w-9 animate-spin text-flash-400" aria-hidden="true" />
      <p className="mt-4 text-[17px] text-midnight-300">Opening the search</p>
      <Link href={href} className="mt-6 text-base font-semibold text-white underline underline-offset-4">
        Open it now
      </Link>
    </div>
  );
}
