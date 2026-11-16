'use client';

/**
 * OpenSearchNotice - shown in place of the lost-pet report's first question
 * when this browser already has a search open and nobody is signed in.
 * Without signing in, one search can be open at a time
 * (app/api/reports/create/route.js), so a second report would be refused at
 * Post. The way on is the search they already have; a second pet needs an
 * account with a password, and a guest's account has none yet, so the set
 * password link is here too.
 */

import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';

export default function OpenSearchNotice({ petName, url }) {
  const name = (petName || '').trim() || 'your pet';
  return (
    <div className="flex-1 flex items-center justify-center px-6 animate-slide-up">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-midnight-900">
          You already have a search open for {name}
        </h1>
        <p className="text-midnight-500 mt-2 leading-relaxed">
          Without signing in, one search can be open at a time. When {name} is home, mark it on the search, and you can
          report another pet here.
        </p>
        <div className="mt-7 space-y-3">
          <Link
            href={url}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold bg-midnight-900 text-white shadow-lg hover:bg-midnight-800 transition-all"
          >
            <MapIcon size={18} aria-hidden="true" />
            Open {name}&apos;s search
          </Link>
          <Link
            href="/login?callbackUrl=%2Freport%2Fnew"
            className="w-full inline-flex items-center justify-center py-3.5 rounded-2xl font-semibold text-midnight-600 bg-midnight-100 hover:bg-midnight-200 transition-colors"
          >
            Sign in to report another pet
          </Link>
        </div>
        <p className="mt-5 text-sm text-midnight-500">
          No password yet?{' '}
          <Link href="/forgot-password" className="font-semibold text-midnight-700 underline underline-offset-2 hover:text-midnight-900">
            Set one with your email
          </Link>
          .
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="font-medium text-midnight-500 hover:text-midnight-800">
            Back to the home page
          </Link>
        </p>
      </div>
    </div>
  );
}
