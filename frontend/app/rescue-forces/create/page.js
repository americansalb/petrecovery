'use client';

/**
 * Start a Rescue Force: pick the town, and that is the whole form.
 *
 * A force covers one town and is named after it ("Austin Rescue Force");
 * POST /api/rescue-forces sets the name and the area itself. The old
 * three-step form asked for a name, a description, a contact email and a
 * radius, and the API threw every one of them away. A description,
 * specialties and divisions are set later, from the force's own settings.
 *
 * The directory sends the town it searched in the URL
 * (app/rescue-forces/startForce.js), so nobody types it twice: the field
 * is filled in, and with `start=1` (the directory's one-tap Start, after a
 * sign-in or the waiver) the force is started on arrival.
 *
 * The API's two refusals are handled here instead of shown as a dead end:
 * the volunteer waiver (a link to accept it, then back here to start) and
 * a town that already has a force (a link to that force).
 */

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import TownPicker, { townLabel } from '../TownPicker';
import { createHref, outcomeHref, startForce, townFromParams } from '../startForce';

export default function CreateForcePage() {
  const { status } = useSession();
  const router = useRouter();
  const [text, setText] = useState('');
  const [town, setTown] = useState(null);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState(null); // { kind: 'waiver' | 'exists' | 'error', message, forceId }
  const startOnArrival = useRef(false);

  // The town from the URL, once: the directory's search, or the way back
  // from sign-in or the waiver.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const given = townFromParams(params);
    if (!given) return;
    setTown(given);
    setText(townLabel(given));
    startOnArrival.current = params.get('start') === '1';
  }, []);

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    // Back here, with the same town, after signing in.
    const here = window.location.pathname + window.location.search;
    router.push(`/login?callbackUrl=${encodeURIComponent(here)}`);
  }, [status, router]);

  async function create(e) {
    e?.preventDefault();
    if (!town || creating) return;
    setCreating(true);
    setProblem(null);
    const outcome = await startForce(town);
    if (outcome.ok || outcome.kind === 'signin') {
      router.push(outcomeHref(outcome, town));
      return;
    }
    if (outcome.kind === 'waiver') setProblem({ kind: 'waiver' });
    else if (outcome.kind === 'exists') setProblem({ kind: 'exists', forceId: outcome.forceId });
    else setProblem({ kind: 'error', message: outcome.message });
    setCreating(false);
  }

  // The directory's one-tap Start, or the way back from sign-in or the
  // waiver: start the force as soon as the person is known to be signed in.
  useEffect(() => {
    if (status !== 'authenticated' || !startOnArrival.current || !town) return;
    startOnArrival.current = false;
    create();
    // create reads the state it needs when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, town]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-midnight-50" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-midnight-400" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const name = town ? `${town.city} Rescue Force` : null;

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-xl px-4 pb-8 pt-3 sm:pt-5">
          <Link href="/rescue-forces" className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900">
            <ChevronLeft size={16} aria-hidden="true" />
            Rescue Forces
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">Start a Rescue Force</h1>
          <p className="mt-2 text-midnight-600">
            A Rescue Force covers one town. Pets reported lost there go to the force, and its members can join the search.
            You will be its founder.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        <form method="post" onSubmit={create} className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6">
          <label htmlFor="create-town" className="block font-medium text-midnight-900">
            Town
          </label>
          <div className="mt-2">
            <TownPicker
              id="create-town"
              text={text}
              onTextChange={(value) => {
                setText(value);
                if (town && value !== townLabel(town)) setTown(null);
                setProblem(null);
              }}
              onPick={setTown}
              placeholder="Start typing your town"
              autoFocus={!town}
            />
          </div>
          <p className="mt-2 text-sm text-midnight-500">
            {name ? (
              <>
                It will be called <strong className="font-semibold text-midnight-800">{name}</strong>.
              </>
            ) : (
              'Pick your town from the list.'
            )}
          </p>

          {problem?.kind === 'waiver' && (
            <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
              <p>Rescue Force volunteers accept a liability waiver first, because searches can involve physical risk.</p>
              <Link
                href={`/legal/consent?returnUrl=${encodeURIComponent(createHref(town, { start: true }))}`}
                className="mt-2 inline-flex items-center font-semibold underline underline-offset-4"
              >
                Read and accept the waiver
              </Link>
              <p className="mt-1 text-sm">{name} starts as soon as you have.</p>
            </div>
          )}
          {problem?.kind === 'exists' && (
            <div role="alert" className="mt-5 rounded-xl bg-midnight-50 p-4 text-midnight-800 ring-1 ring-midnight-200">
              <p>{town?.city || 'This town'} already has a Rescue Force. Join it instead.</p>
              {problem.forceId && (
                <Link href={`/rescue-forces/${problem.forceId}`} className="mt-2 inline-flex items-center font-semibold underline underline-offset-4">
                  Go to {name || 'the force'}
                </Link>
              )}
            </div>
          )}
          {problem?.kind === 'error' && (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
              {problem.message}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth className="mt-6" disabled={!town} loading={creating} leftIcon={Plus}>
            {name ? `Start ${name}` : 'Start the Rescue Force'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-midnight-500">
          After it&apos;s set up, you can add a description and what your volunteers can do in the force&apos;s settings, and
          split a big town into divisions.
        </p>
      </main>
    </div>
  );
}
