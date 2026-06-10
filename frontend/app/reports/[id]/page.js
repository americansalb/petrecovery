'use client';

/**
 * Legacy report detail route
 *
 * Reports ARE cases; the case page is their one home now (it carries
 * the story, the sighting CTA, and the owner's mark-as-reunited).
 * This route just resolves the id to a case number and forwards.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ReportDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/missions/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!alive) return;
        if (data?.caseNumber) {
          router.replace(`/cases/${data.caseNumber}`);
        } else {
          setFailed(true);
        }
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [params.id, router]);

  if (failed) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md bg-white rounded-3xl border-2 border-midnight-100 p-8">
          <AlertCircle className="w-12 h-12 text-midnight-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-midnight-900 mb-2">Report not found</h1>
          <p className="text-midnight-500 mb-6">It may have been removed, or the link is old.</p>
          <Link
            href="/lost-and-found"
            className="inline-flex items-center gap-2 px-5 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition"
          >
            Browse Lost &amp; Found
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-midnight-300" />
    </div>
  );
}
