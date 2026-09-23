'use client';

/**
 * Find the Rescue Force near a town or ZIP.
 *
 * The town field (./TownPicker.js) suggests real towns, so "Austin" can be
 * Austin, TX rather than whichever Austin the server picks first. The search
 * itself is /api/rescue-forces, which answers the towns in range and whether
 * each has a force. `?q=Austin, TX` in the address runs it on arrival (the
 * home page's town links send that, and old /rescue-forces/search links
 * arrive here through a redirect in next.config.js).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { normalizeState } from '@/app/lib/usStates';
import TownPicker, { townLabel } from './TownPicker';

const RADIUS_MILES = 25;

/** "Austin, TX" -> { city: 'Austin', state: 'TX' }; "78704" -> { zip }. */
function parseTyped(text) {
  const t = text.trim();
  if (/^\d{5}$/.test(t)) return { zip: t };
  const [city, state] = t.split(',').map((p) => p.trim());
  return { city, state: state ? normalizeState(state) : '' };
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function ForceSearch() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | empty | searching | done | notfound | failed
  const [result, setResult] = useState(null); // { label, forces }

  async function run({ suggestion, typed }) {
    setStatus('searching');
    const params = new URLSearchParams({ radius: String(RADIUS_MILES) });
    let label;
    if (suggestion) {
      label = townLabel(suggestion);
      params.set('search', suggestion.city);
      if (suggestion.state_id) params.set('state', suggestion.state_id);
      if (suggestion.country && suggestion.country !== 'US') {
        params.set('country', suggestion.country);
        if (suggestion.lat != null) params.set('lat', String(suggestion.lat));
        if (suggestion.lng != null) params.set('lng', String(suggestion.lng));
      }
    } else {
      const parsed = parseTyped(typed);
      label = typed.trim();
      params.set('search', parsed.zip || parsed.city);
      if (parsed.state) params.set('state', parsed.state);
    }
    try {
      const res = await fetch(`/api/rescue-forces?${params}`);
      if (res.status === 400) {
        setResult({ label });
        setStatus('notfound');
        return;
      }
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      const forces = (data.cities || [])
        .filter((row) => row.exists && row.squad)
        .map((row) => ({ ...row.squad, city: row.city, state: row.state, distance: row.distance }));
      setResult({ label, forces });
      setStatus('done');
    } catch {
      setResult({ label });
      setStatus('failed');
    }
  }

  function submit(e) {
    e.preventDefault();
    if (text.trim()) {
      run({ typed: text });
    } else {
      // An empty search used to do nothing at all when clicked.
      setStatus('empty');
      document.getElementById('force-town')?.focus();
    }
  }

  // Deep link: /rescue-forces?q=Austin, TX
  useEffect(() => {
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim();
    if (q) {
      setText(q);
      run({ typed: q });
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <form method="post" onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="flex-1">
          <TownPicker
            id="force-town"
            text={text}
            onTextChange={setText}
            onPick={(s) => run({ suggestion: s })}
            onEnter={() => text.trim() && run({ typed: text })}
          />
        </div>
        <Button type="submit" size="lg" leftIcon={Search} loading={status === 'searching'}>
          Find a Rescue Force
        </Button>
      </form>

      <div aria-live="polite">
        {status === 'done' && result && (
          <div className="mt-5 rounded-2xl bg-midnight-50 p-4 ring-1 ring-midnight-200 sm:p-5">
            {result.forces.length > 0 ? (
              <>
                <p className="font-semibold text-midnight-900">
                  {plural(result.forces.length, 'Rescue Force', 'Rescue Forces')} within {RADIUS_MILES} miles of {result.label}
                </p>
                <ul className="mt-3 divide-y divide-midnight-200 overflow-hidden rounded-xl bg-white ring-1 ring-midnight-200">
                  {result.forces.map((f) => (
                    <li key={f.id}>
                      <Link href={`/rescue-forces/${f.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-midnight-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-midnight-900">{f.name}</span>
                          <span className="block text-sm text-midnight-500">
                            {[
                              [f.city, f.state].filter(Boolean).join(', '),
                              typeof f.distance === 'number' && f.distance >= 0.5 && `${f.distance.toFixed(0)} mi away`,
                              plural(f.memberCount || 0, 'member', 'members'),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <ChevronRight size={18} className="shrink-0 text-midnight-300" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-midnight-700">No Rescue Force within {RADIUS_MILES} miles of {result.label} yet.</p>
                <Button href="/rescue-forces/create" variant="secondary" leftIcon={Plus}>
                  Start one
                </Button>
              </div>
            )}
          </div>
        )}
        {status === 'empty' && <p className="mt-4 text-midnight-600">Type a town or a ZIP code first.</p>}
        {status === 'notfound' && (
          <p className="mt-4 text-midnight-600">
            We couldn&apos;t find &ldquo;{result?.label}&rdquo;. Pick a town from the list, or type a ZIP code.
          </p>
        )}
        {status === 'failed' && (
          <p className="mt-4 text-midnight-600">The search didn&apos;t go through. Check your connection and try again.</p>
        )}
      </div>
    </div>
  );
}
