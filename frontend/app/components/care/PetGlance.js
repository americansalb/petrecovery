'use client';

/**
 * "Is this animal OK?" - the calm glance that answers the question in one
 * look: vaccine standing, weight, active medications, any medical note,
 * and the vet you would phone.
 *
 * This was inline in the owner's Today page. It is the strongest piece of
 * the Health Book, so the shelter's animal page uses the same component
 * rather than a flatter re-invention of it: whoever is caring for an
 * animal gets the same instrument, whether they own it or work at the
 * shelter housing it.
 */

import Link from 'next/link';
import {
  Syringe, Check, AlertCircle, TrendingDown, Heart, Phone, ChevronRight,
} from 'lucide-react';
import { cn } from '@/components/ui';
import { Card, Overline } from '@/app/components/care/kit/Tile';
import { vaccinationStatus, latestPerName, rankVaccinations, weightTrendSummary } from '@/lib/healthBook';
import { isLowSupply } from '@/lib/medications';

const shortMonth = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });

function initialsOf(name) {
  if (!name) return 'V';
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
  return (parts[0]?.[0] || 'V').toUpperCase();
}

/**
 * `show` picks which panels render. The owner's Today page wants all of
 * them, because the editable versions live on another page. A surface
 * that already edits vaccines and weight in view should ask only for
 * ['note', 'vet'], or it will summarise what is on screen beside it.
 */
export default function PetGlance({
  pet, name, vaccinations = [], weights = [], meds = [], healthHref, heading,
  show = ['vaccines', 'vitals', 'note', 'vet'],
}) {
  const wants = (k) => show.includes(k);
  const petName = name || pet?.name || 'this animal';
  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const activeMeds = medItems.filter((m) => m.isActive);
  const lowCount = activeMeds.filter(isLowSupply).length;
  // One live stamp per vaccine (a backfilled older Rabies must not count
  // beside the current one), attention first: ordering by recency can bury
  // an expired shot below three current ones, so "Is X OK?" reads
  // all-green while a vaccine has lapsed.
  const liveVax = latestPerName(vaccinations);
  const withExpiry = liveVax.filter((v) => v.expiresAt);
  const vaxCurrent = withExpiry.filter((v) => vaccinationStatus(v) === 'PROTECTED').length;
  const rankedVax = rankVaccinations(liveVax);
  const latestWeight = weights[weights.length - 1];
  const weightTrend = weightTrendSummary(weights);

  const anything = (wants('vaccines') || wants('vitals'))
    || (wants('note') && pet?.medicalConditions)
    || (wants('vet') && (pet?.vetName || pet?.vetClinic || pet?.vetPhone));
  if (!anything) return null;

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Overline>{heading || `Is ${petName} OK?`}</Overline>
        {healthHref && (
          <Link href={healthHref} className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-care-teal">
            Health <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {wants('vaccines') && (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-care-tealWash text-care-teal flex items-center justify-center"><Syringe size={15} /></span>
            <b className="text-[13.5px] font-semibold text-care-ink">Vaccines</b>
          </span>
          <span className="text-[11.5px] text-care-sub">
            {withExpiry.length
              ? <><b className="text-care-ink font-semibold">{vaxCurrent}</b> of {withExpiry.length} current</>
              : `${vaccinations.length} on file`}
          </span>
        </div>
        <div className="px-4 pb-2">
          {rankedVax.slice(0, 3).map((v, idx) => {
            const st = vaccinationStatus(v);
            return (
              <div key={v.id} className={cn('flex items-center gap-2.5 py-2.5', idx > 0 && 'border-t border-care-line')}>
                {st === 'EXPIRED' ? (
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                ) : st === 'DUE_SOON' ? (
                  <AlertCircle size={16} className="text-care-amber shrink-0" />
                ) : (
                  <Check size={16} className="text-care-teal shrink-0" />
                )}
                <span className="flex-1 min-w-0 text-[13px] font-semibold text-care-ink truncate">{v.name}</span>
                {st === 'EXPIRED' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-2 py-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Expired {v.expiresAt ? shortMonth(v.expiresAt) : ''}
                  </span>
                ) : st === 'DUE_SOON' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-care-amber bg-care-amberWash ring-1 ring-care-amberLine rounded-lg px-2 py-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-care-amber" />
                    Due {v.expiresAt ? shortMonth(v.expiresAt) : 'soon'}
                  </span>
                ) : (
                  // A vaccine with no expiry on file is "on file", never "to <given date>":
                  // the given date is in the past and reads as false coverage.
                  <span className="text-[11.5px] text-care-sub shrink-0">
                    {v.expiresAt ? <>to <b className="text-care-ink font-semibold">{shortMonth(v.expiresAt)}</b></> : 'on file'}
                  </span>
                )}
              </div>
            );
          })}
          {liveVax.length === 0 && <p className="text-[12.5px] text-care-sub py-2.5">None on file yet.</p>}
        </div>
      </Card>
      )}

      {wants('vitals') && (
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <Overline>Weight</Overline>
          {latestWeight ? (
            <>
              <div className="flex items-baseline gap-1 mt-2.5">
                <span className="text-[27px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">{latestWeight.weightLbs}</span>
                <span className="text-[12px] text-care-sub">lb</span>
              </div>
              {/* Real window, not a hardcoded "6 mo": the delta is latest vs
                  the oldest entry in the last 90 days, labelled with the
                  actual span between them. */}
              {weightTrend?.delta != null && weightTrend.delta !== 0 && (
                <div className="flex items-center gap-1 mt-2 text-[11px] text-care-teal font-semibold">
                  <TrendingDown size={12} className={weightTrend.delta > 0 ? 'rotate-180' : ''} />
                  {Math.abs(weightTrend.delta)} lb · {weightTrend.spanLabel}
                </div>
              )}
            </>
          ) : <p className="text-[12px] text-care-sub mt-2.5">Not logged</p>}
        </Card>
        <Card className="p-4">
          <Overline>Active meds</Overline>
          <div className="flex items-baseline gap-1 mt-2.5">
            <span className="text-[27px] font-semibold tracking-tight text-care-ink tabular-nums leading-none">{activeMeds.length}</span>
            <span className="text-[12px] text-care-sub">meds</span>
          </div>
          {lowCount > 0 && <div className="mt-2 text-[11px] text-care-amber font-semibold">{lowCount} low on supply</div>}
        </Card>
      </div>
      )}

      {wants('note') && pet?.medicalConditions && (
        <Card className="flex items-center gap-3 p-4">
          <span className="w-8 h-8 rounded-[9px] bg-[#f4f5f4] text-care-sub flex items-center justify-center shrink-0"><Heart size={16} /></span>
          <div className="min-w-0">
            <Overline>Medical note</Overline>
            <p className="text-[13.5px] font-semibold text-care-ink truncate mt-0.5">{pet.medicalConditions}</p>
          </div>
        </Card>
      )}

      {wants('vet') && (pet?.vetName || pet?.vetClinic || pet?.vetPhone) && (
        <Card className="flex items-center gap-3 p-4">
          <span className="w-11 h-11 rounded-[13px] bg-care-tealWash text-care-teal flex items-center justify-center shrink-0 font-serif text-[17px] font-semibold">{initialsOf(pet.vetName || pet.vetClinic)}</span>
          <div className="flex-1 min-w-0">
            <Overline>Primary vet</Overline>
            {/* A phone number alone is still a reachable vet - never hide it. */}
            <b className="block text-[14.5px] font-semibold text-care-ink mt-0.5 truncate">{pet.vetName || pet.vetClinic || pet.vetPhone}</b>
            <span className="text-[11.5px] text-care-sub truncate block">{[pet.vetClinic, (pet.vetName || pet.vetClinic) ? pet.vetPhone : null].filter(Boolean).join(' · ')}</span>
          </div>
          {pet.vetPhone && (
            <a href={`tel:${pet.vetPhone}`} aria-label="Call clinic" className="w-11 h-11 rounded-[13px] bg-care-teal text-white flex items-center justify-center shrink-0 hover:bg-care-tealDark transition-colors">
              <Phone size={18} />
            </a>
          )}
        </Card>
      )}
    </aside>
  );
}
