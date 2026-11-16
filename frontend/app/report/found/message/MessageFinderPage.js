'use client';

/**
 * The page around MessageFinder: the found pet, the form, and the way back
 * to its report. The report layout covers the whole screen, so the way out
 * is always on it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { X, PawPrint } from 'lucide-react';
import { MessageFinder } from '@/components/case/MessageFinder';

export default function MessageFinderPage() {
  const caseNumber = useSearchParams().get('case') || '';
  const [info, setInfo] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!caseNumber) {
      setMissing(true);
      return;
    }
    let live = true;
    fetch(`/api/reports/${encodeURIComponent(caseNumber)}/message`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((data) => live && setInfo(data))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [caseNumber]);

  const back = caseNumber ? `/cases/${encodeURIComponent(caseNumber)}` : '/lost-and-found';

  return (
    <div className="h-full overflow-y-auto bg-midnight-50">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mb-5 flex items-center justify-between">
          <Link href={back} className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-midnight-700">
            <X size={18} aria-hidden="true" />
            {caseNumber ? 'Back to the report' : 'Lost and Found'}
          </Link>
        </div>

        <h1 className="text-[26px] font-extrabold leading-8 tracking-tight text-midnight-900">Write to the finder</h1>

        {missing ? (
          <p className="mt-4 text-[15px] text-midnight-600">There is no found-pet report at this link.</p>
        ) : !info ? (
          <p className="mt-4 text-[15px] text-midnight-500">Loading the report</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-midnight-200">
              {info.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-midnight-100 text-midnight-400">
                  <PawPrint size={26} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-midnight-900">{info.petName || `Found ${info.kind}`}</p>
                <Link href={back} className="text-[14px] font-semibold text-midnight-600 underline underline-offset-4">
                  See the report
                </Link>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
              {info.open ? (
                <MessageFinder caseNumber={info.caseNumber} kind={info.kind} reachBy={info.reachBy} />
              ) : (
                <p className="text-[15px] text-midnight-700">This report is closed, so messages no longer go to the finder.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
