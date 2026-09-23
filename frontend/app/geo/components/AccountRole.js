'use client';

/**
 * What this account is, on the profile page: its role, and only when it
 * has one.
 *
 * This replaced a plan card. The card named a tier, listed what the
 * tier was worth, and said what a Supporter would get on top; every
 * line of it described Google Street View limits. The founder has since
 * settled both halves of that, in the same week: Apple only, and
 * "100% free, no paid option". So there is no plan to name, and a card
 * advertising one at somebody would be inventing a price list the
 * company has not got.
 *
 * Role survives, because it is not a price. Host and admin are jobs a
 * person has been given (app/lib/geo/server/roles.js), and somebody who
 * has one should be able to see it rather than infer it from which
 * screens let them in. An ordinary player sees nothing here, which is
 * correct: there is nothing to say.
 *
 * The tier columns stay on the account row. They cost nothing at rest,
 * and taking them out means a migration on the database the pet site
 * shares, which is not a thing to do for tidiness.
 */

import { useEffect, useState } from 'react';
import Card from './ui/Card';
import { ShieldCheck } from 'lucide-react';

const LABELS = { admin: 'Admin', host: 'Host' };

export default function AccountRole() {
  const [role, setRole] = useState('');

  useEffect(() => {
    let live = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live && data?.signedIn) setRole(data.account?.role || '');
      })
      .catch(() => {
        // Not knowing is the same as nothing to show.
      });
    return () => {
      live = false;
    };
  }, []);

  if (!LABELS[role]) return null;

  return (
    <Card data-account-role>
      <h2 className="ui-h2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-pe-muted" />
        Role
      </h2>
      <p className="mt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pe-accent/15 px-3 py-1 text-sm font-bold text-pe-accent-fg">
          <ShieldCheck className="h-3.5 w-3.5" />
          {LABELS[role]}
        </span>
      </p>
      <p className="mt-2 text-sm text-pe-muted">
        {role === 'admin' ? 'You can open the backend at /geo/admin.' : 'You can open private rooms.'}
      </p>
    </Card>
  );
}
