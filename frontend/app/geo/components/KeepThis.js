'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark } from 'lucide-react';
import Card from './ui/Card';
import SignInCard from './SignInCard';

export default function KeepThis({ compact = false, returnTo = '/geo/me' }) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (live && data) setShow(!data.signedIn); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!show) return null;
  return (
    <Card pad="sm" className={compact ? '' : 'mt-4'} data-keep-this>
      <div className="flex items-center gap-3">
        <Bookmark size={22} className="shrink-0 text-pe-accent-fg" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-pe-fg">Keep this game</p>
          <p className="text-sm text-pe-muted">Sign in to save your scores and rating to your account.</p>
        </div>
        {!expanded ? (
          <button className="ui-btn ui-btn--primary pe-button pe-button--primary shrink-0" type="button" onClick={() => setExpanded(true)}>
            Sign in <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="mt-4 border-t border-pe-line pt-4">
          <SignInCard requireName returnTo={returnTo} onAuthenticated={() => setShow(false)} />
        </div>
      ) : null}
    </Card>
  );
}
