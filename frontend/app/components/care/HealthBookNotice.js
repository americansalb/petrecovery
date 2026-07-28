'use client';

/**
 * The Health Book's one-time "quick heads-up" card.
 *
 * Anyone using the Health Book should have agreed to the current Terms
 * (which carry the health-record disclosures). New signups accept at
 * registration; this card catches everyone from before the Terms grew
 * the Health Book section. Tone is deliberately casual - four
 * common-sense lines and one button - but tapping it records a real,
 * versioned Terms acceptance via /api/legal/accept.
 *
 * Fails open: if the status check errors, we show nothing rather than
 * nag. The room's permanent footer disclaimer still renders either way.
 */

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/app/components/care/kit/Tile';

export default function HealthBookNotice({ petName = 'your pet' }) {
  const [activeVersion, setActiveVersion] = useState(null);
  const [needed, setNeeded] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/legal/accept')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.termsOfService) return;
        const t = data.termsOfService;
        if (t.activeVersion && !t.current) {
          setActiveVersion(t.activeVersion);
          setNeeded(true);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!needed) return null;

  const agree = async () => {
    if (agreeing) return;
    setAgreeing(true);
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptances: [{ documentType: 'TERMS_OF_SERVICE', version: activeVersion }] }),
      });
      if (res.ok) setNeeded(false);
    } finally { setAgreeing(false); }
  };

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-[9px] bg-care-tealWash text-care-teal flex items-center justify-center shrink-0"><BookOpen size={16} /></span>
        <div className="min-w-0">
          <p className="text-care-base font-semibold text-care-ink">One quick thing about the Health Book</p>
          <ul className="mt-2 space-y-1.5 text-care-sm text-care-sub list-disc pl-4">
            <li>It&apos;s a record you keep, not medical advice. Your vet always has the final word.</li>
            <li>Statuses are just date math on what you enter, so double-check against the paper certificate. For anything official (travel, boarding, licensing), the vet&apos;s paperwork is the real document.</li>
            <li>Share links show {petName}&apos;s record to anyone holding the link. You can revoke them anytime.</li>
            <li>If {petName} ever seems unwell, call your vet or an emergency clinic first, not an app.</li>
          </ul>
          <div className="mt-3.5 flex items-center gap-4">
            <button
              onClick={agree}
              disabled={agreeing}
              className="rounded-xl bg-care-teal text-white text-care-sm font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-40"
            >
              {agreeing ? 'Saving...' : 'Sounds good, I agree'}
            </button>
            <Link href="/legal/terms" target="_blank" className="text-care-sm font-medium text-care-sub hover:text-care-ink">
              Read the full terms
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
