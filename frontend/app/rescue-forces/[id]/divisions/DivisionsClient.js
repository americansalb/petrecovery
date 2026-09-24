'use client';

/**
 * The division list, and for founders and leaders the add, edit and delete
 * forms. APIs: GET/POST /api/rescue-forces/[id]/divisions, PATCH/DELETE
 * .../divisions/[divisionId]. A division's area is a US ZIP code's centre
 * and a radius; the API looks the ZIP up.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';

const RADII = [1, 2, 3, 5, 10];

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function areaLabel(d) {
  return d.hasArea && d.zipCode ? `${d.radiusMiles} mi around ${d.zipCode}` : 'No area set';
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-midnight-200 bg-white px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400';

function DivisionForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [zipCode, setZipCode] = useState(initial?.zipCode || '');
  const [radius, setRadius] = useState(initial?.radiusMiles || 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const idp = initial?.id || 'new';

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (zipCode && !/^\d{5}$/.test(zipCode.trim())) {
      setError('A ZIP code has 5 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), zipCode: zipCode.trim(), radiusMiles: Number(radius) });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor={`name-${idp}`} className="block text-sm font-medium text-midnight-800">
          Name
        </label>
        <input id={`name-${idp}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="North Side" className={fieldClass} />
      </div>
      <div>
        <label htmlFor={`desc-${idp}`} className="block text-sm font-medium text-midnight-800">
          Description <span className="font-normal text-midnight-500">(optional)</span>
        </label>
        <input id={`desc-${idp}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="North of the river" className={fieldClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`zip-${idp}`} className="block text-sm font-medium text-midnight-800">
            Area: ZIP code
          </label>
          <input
            id={`zip-${idp}`}
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
            inputMode="numeric"
            placeholder="78704"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`radius-${idp}`} className="block text-sm font-medium text-midnight-800">
            Area: miles around it
          </label>
          <select id={`radius-${idp}`} value={radius} onChange={(e) => setRadius(e.target.value)} className={fieldClass}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {plural(r, 'mile', 'miles')}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-midnight-500">The area puts the division on the map and matches missing pets to it.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

async function call(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not save. Try again.');
  return data;
}

function DivisionRow({ d, forceId, canManage, onChanged }) {
  const [mode, setMode] = useState('view'); // view | edit | delete
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const leaders = (d.leaders || []).map((l) => l.user?.firstName).filter(Boolean);

  if (mode === 'edit') {
    return (
      <li className="p-4">
        <DivisionForm
          initial={d}
          submitLabel="Save"
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            await call(`/api/rescue-forces/${forceId}/divisions/${d.id}`, 'PATCH', values);
            setMode('view');
            onChanged();
          }}
        />
      </li>
    );
  }

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <Link href={`/rescue-forces/${forceId}/divisions/${d.id}`} className="group min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold text-midnight-900 group-hover:underline">
            {d.name}
            <ChevronRight size={16} className="text-midnight-300" aria-hidden="true" />
          </span>
          {d.description && <span className="mt-0.5 block text-midnight-600">{d.description}</span>}
          <span className="mt-1 block text-sm text-midnight-500">
            {[plural(d.memberCount || 0, 'member', 'members'), leaders.length > 0 && `Led by ${leaders.join(', ')}`, areaLabel(d)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </Link>
        {canManage && mode === 'view' && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" aria-label={`Edit ${d.name}`} onClick={() => setMode('edit')}>
              <Pencil size={16} aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => setMode('delete')}>
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {mode === 'delete' && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
          <p className="text-sm text-red-900">
            Delete {d.name}? Its members stay in the force without a division.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await call(`/api/rescue-forces/${forceId}/divisions/${d.id}`, 'DELETE');
                  onChanged();
                } catch (err) {
                  setError(err.message);
                  setBusy(false);
                }
              }}
            >
              Delete division
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}

export default function DivisionsClient({ forceId, canManage }) {
  const [divisions, setDivisions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/divisions`);
      if (!res.ok) throw new Error(String(res.status));
      setDivisions((await res.json()).divisions || []);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [forceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-midnight-500" aria-busy="true">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Loading divisions
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
        <p className="text-midnight-700">The divisions did not load.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => { setStatus('loading'); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage &&
        (adding ? (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
            <p className="mb-3 font-semibold text-midnight-900">New division</p>
            <DivisionForm
              submitLabel="Add division"
              onCancel={() => setAdding(false)}
              onSubmit={async (values) => {
                await call(`/api/rescue-forces/${forceId}/divisions`, 'POST', values);
                setAdding(false);
                load();
              }}
            />
          </div>
        ) : (
          <Button leftIcon={Plus} onClick={() => setAdding(true)}>
            Add a division
          </Button>
        ))}

      {divisions.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
          {canManage ? 'No divisions yet. A small town usually does not need any.' : 'This force has no divisions.'}
        </p>
      ) : (
        <ul className="divide-y divide-midnight-100 overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
          {divisions.map((d) => (
            <DivisionRow key={d.id} d={d} forceId={forceId} canManage={canManage} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
