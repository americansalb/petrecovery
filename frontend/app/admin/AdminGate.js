'use client';

/**
 * Holds the admin section until the session is known.
 *
 * Every admin page ends its auth check with some version of
 *
 *   if (!session || session.user.role !== 'ADMIN') return null;
 *
 * which is correct once the session has loaded and wrong before it has:
 * useSession() reports status 'loading' with data undefined for the first
 * moments after navigation, so !session is true and the page returns
 * null. An admin opening /admin/divisions got a blank white screen with
 * no spinner and no explanation, then the page appeared.
 *
 * Nine admin pages had no loading guard at all. Rather than patch the
 * same three lines into each, the gate lives here: while the session is
 * loading nothing below this layout renders, so each page's own check
 * only ever runs against a settled session.
 *
 * This is not the access control. middleware.js decides who may be here
 * at all, before any of this reaches the browser. This is about what the
 * person sees while the answer is on its way.
 */

import { useSession } from 'next-auth/react';

export default function AdminGate({ children }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
          role="status"
          aria-label="Checking your access"
        />
        <p className="text-sm text-slate-500">Checking your access...</p>
      </div>
    );
  }

  return children;
}
