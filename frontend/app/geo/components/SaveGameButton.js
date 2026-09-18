'use client';

import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import AccountDialog from './AccountDialog';

export default function SaveGameButton({ returnTo, className = '' }) {
  const [guest, setGuest] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((data) => { if (alive && data) setGuest(!data.signedIn); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!guest) return null;
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)} aria-label="Save game" title="Save game"><Bookmark size={18} aria-hidden="true" /></button>
    {open ? <AccountDialog returnTo={returnTo} onClose={() => setOpen(false)} onAuthenticated={() => { setOpen(false); setGuest(false); }} /> : null}
  </>;
}
