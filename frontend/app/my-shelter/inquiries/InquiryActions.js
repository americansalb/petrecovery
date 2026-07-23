'use client';

/**
 * Work an inquiry: mark replied after you answer, close when it's
 * resolved (adopted, withdrawn, or spam). Reopen puts it back in the
 * new pile if it was closed by mistake.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function InquiryActions({ inquiryId, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');

  const setStatus = async (next) => {
    setBusy(next);
    try {
      await fetch(`/api/shelter/inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy('');
    }
  };

  const Btn = ({ next, children }) => (
    <button
      onClick={() => setStatus(next)}
      disabled={Boolean(busy)}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-midnight-600 hover:text-midnight-900 disabled:opacity-50 transition"
    >
      {busy === next && <Loader2 className="w-3 h-3 animate-spin" />}
      {children}
    </button>
  );

  if (status === 'CLOSED') return <Btn next="NEW">Reopen</Btn>;
  return (
    <span className="inline-flex items-center gap-3">
      {status === 'NEW' && <Btn next="REPLIED">Mark replied</Btn>}
      <Btn next="CLOSED">Close</Btn>
    </span>
  );
}
