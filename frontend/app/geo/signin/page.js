'use client';

/**
 * Signing in.
 *
 * One heading, one line saying what happens, and the form: an email,
 * then the code from it (components/SignInCard.js). It used to carry
 * two headings ("Sign in", then "Sign in, or start an account"), a
 * paragraph explaining accounts, and a player-name field for people who
 * did not have one, all above the one field that mattered (founder,
 * 2026-09-23: "Very unclear. Why not just have normal sign in
 * process?").
 *
 * `next` is read with useSearchParams rather than the searchParams prop:
 * this is a client page, and Next 15 hands a client page a promise
 * there. It silently returning undefined would land a signed-in player
 * on the profile page instead of the round they left, which is the
 * failure this whole return path exists to prevent.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SignInCard from '../components/SignInCard';
import { safeReturnTo } from '@/app/lib/geo/authReturn';

function SignInForm() {
  const searchParams = useSearchParams();
  const next = safeReturnTo(searchParams.get('next'));
  return <SignInCard requireName returnTo={next} continueTo={next} />;
}

export default function GeoSignInPage() {
  return (
    <main className="ui-page ui-page--narrow">
      <Link href="/geo" className="ui-btn ui-btn--ghost ui-btn--sm -ml-3">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>
      <h1 className="ui-h1 mt-6">Sign in</h1>
      <p className="ui-lead mt-2">Keep your scores, rating and badges on every device.</p>
      <div className="ui-card mt-8 p-5 sm:p-6">
        {/* useSearchParams needs a boundary or the whole route opts out
            of static rendering at build time. */}
        <Suspense fallback={<SignInCard requireName returnTo="/geo/me" continueTo="/geo/me" />}>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
