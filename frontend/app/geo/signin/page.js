'use client';

/**
 * Signing in.
 *
 * The Sign in link used to point at /geo/me, the profile page. Somebody
 * who has never played, clicking Sign in, was shown "YOUR PROFILE", a
 * name they never chose ("Player"), a rating of 1500, a shop full of
 * things priced in points they do not have, and a line reading "In this
 * browser only". Every word of that is true of the anonymous profile
 * the browser gets on its first round, and none of it is an answer to
 * "let me sign in" (founder, 2026-09-17: "why does it pretend I have an
 * account named player").
 *
 * So this page does one thing and says one thing.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SignInCard from '../components/SignInCard';
import { safeReturnTo } from '@/app/lib/geo/authReturn';

export default function GeoSignInPage({ searchParams }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <Link href="/geo" className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Probably Earth
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Sign in</h1>
      {/* No paragraph here. The card below says what signing in does,
          and a page that says it first makes the screen read the same
          sentence twice. */}
      <div className="mt-6">
        <SignInCard requireName returnTo={safeReturnTo(searchParams?.next)} />
      </div>
    </main>
  );
}
