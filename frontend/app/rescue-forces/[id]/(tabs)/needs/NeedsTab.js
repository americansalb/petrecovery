'use client';

/**
 * The Needs tab: what the force's searches need done now, most urgent
 * first, and what members finished lately. A member taps "I will do it",
 * then "Done" when finished (or "I can't after all"); anyone else is asked
 * to join first. The rules are in app/lib/forceNeeds.js; this page only
 * posts to /api/rescue-forces/[id]/needs/[needId] and refreshes.
 */

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Shield } from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PET_COLOR } from '@/app/lib/petColors';
import NeedCard from '@/app/components/help/NeedCard';
import { useForce } from '../ForceShell';

function PetFace({ pet }) {
  const [failed, setFailed] = useState(false);
  const box = 'h-14 w-14 shrink-0 rounded-xl';
  if (!pet) {
    return (
      <span className={`${box} flex items-center justify-center bg-midnight-900 text-flash-400`} aria-hidden="true">
        <Shield className="h-6 w-6" />
      </span>
    );
  }
  const ring = { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${PET_COLOR[pet.status] || PET_COLOR.closed}` };
  const face =
    !pet.photo || failed ? (
      <span className={`${box} flex items-center justify-center bg-midnight-100 text-midnight-400`} style={ring}>
        <SpeciesIcon species={String(pet.species || '').toUpperCase()} size={24} />
      </span>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pet.photo} alt="" loading="lazy" onError={() => setFailed(true)} className={`${box} bg-midnight-100 object-cover`} style={ring} />
    );
  return (
    <Link href={`/cases/${encodeURIComponent(pet.caseNumber)}`} aria-label={`${pet.name}'s page`} className="m-1 shrink-0">
      {face}
    </Link>
  );
}

export default function NeedsTab({ needs, recent }) {
  const { force, viewer, join, joining } = useForce();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [inflight, setInflight] = useState(false);
  const [active, setActive] = useState(null); // `${needId}:${action}`, until the page has the new state
  const [errors, setErrors] = useState({});
  const member = viewer.isMember;
  const working = inflight || refreshing;

  useEffect(() => {
    if (!inflight && !refreshing) setActive(null);
  }, [inflight, refreshing]);

  async function act(need, action) {
    if (!member) {
      join();
      return;
    }
    setActive(`${need.id}:${action}`);
    setInflight(true);
    setErrors((e) => ({ ...e, [need.id]: '' }));
    try {
      const res = await fetch(`/api/rescue-forces/${force.id}/needs/${need.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'That did not go through. Try again in a moment.');
      startRefresh(() => router.refresh());
    } catch (e) {
      setErrors((x) => ({ ...x, [need.id]: e.message }));
    } finally {
      setInflight(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 lg:pb-10">
      <h2 className="text-xl font-extrabold tracking-tight text-midnight-900">Help needed right now</h2>
      <p className="mt-1 text-[15px] text-midnight-600">
        {member
          ? 'Owners and leaders asked for these. Pick one near you.'
          : `Owners and leaders asked for these. Join ${force.name} to take one on.`}
      </p>

      {needs.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-midnight-50 px-5 py-6 text-midnight-600 ring-1 ring-midnight-200">
          Nothing is needed right now.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {needs.map((n) => (
            <NeedCard
              key={n.id}
              need={n}
              face={<PetFace pet={n.pet} />}
              meta={[n.pet ? n.pet.name : 'The whole force', n.asked]}
              working={working}
              spinning={active?.startsWith(`${n.id}:`) ? active.slice(n.id.length + 1) : null}
              error={errors[n.id]}
              onAct={(action) => act(n, action)}
              takeDisabled={!member && joining}
            />
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-8">
          <h2 id="recent-heading" className="text-lg font-extrabold tracking-tight text-midnight-900">
            Recent activity
          </h2>
          <ul className="mt-2 divide-y divide-midnight-100">
            {recent.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-700" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 text-[15px] text-midnight-800">{a.text}</span>
                <span className="shrink-0 text-sm text-midnight-500">{a.when}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
