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
        <Bookmark size={24} className="shrink-0 text-clay-300" aria-hidden="true" />
        <div className="flex-1"><p className="font-semibold">Keep this game</p><p className="text-sm text-white/70">Save your progress with a free account.</p></div>
        {!expanded ? <button className="pe-button pe-button--primary min-h-[48px] px-4" type="button" onClick={() => setExpanded(true)}>Save <ArrowRight size={16} aria-hidden="true" /></button> : null}
      </div>
      {expanded ? <SignInCard compact requireName returnTo={returnTo} onAuthenticated={() => setShow(false)} /> : null}
    </Card>
  );
}
