'use client';

/**
 * "Add a need for Max": ready-made needs for the pet first (search where
 * it was seen last, check the nearest shelter, knock on doors, put up
 * flyers), one tap each. "Change details" and "Write your own" open the
 * form: where, when, how many people, and a short note.
 *
 * Choices come from /api/rescue-forces/[id]/needs/options; adding posts to
 * /api/rescue-forces/[id]/needs, which checks the fields and answers a need
 * the pet already has with 409 and `duplicate` (app/lib/forceNeeds.js).
 */

import { useEffect, useState } from 'react';
import { Building2, DoorOpen, FileText, Loader2, Minus, Pencil, Plus, Search } from 'lucide-react';
import { Modal } from '@/components/ui';

const KIND_ICON = { area: Search, doors: DoorOpen, flyers: FileText, shelter: Building2, other: Pencil };
const NOTE_MAX = 140;

const peopleText = (n) => (n === 1 ? '1 person' : `${n} people`);

const CHIP =
  'inline-flex h-10 min-h-0 items-center rounded-full border-2 px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const TEXT_BUTTON = 'inline min-h-0 min-w-0 p-0 text-sm font-semibold text-midnight-700 underline underline-offset-4 hover:text-midnight-950';

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function Choice({ on, onPick, label, why }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`flex w-full min-h-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition ${
        on ? 'border-midnight-900 bg-midnight-50' : 'border-midnight-200 bg-white hover:border-midnight-300'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-midnight-900' : 'border-midnight-400'}`}
        aria-hidden="true"
      >
        {on && <span className="h-2.5 w-2.5 rounded-full bg-midnight-900" />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-midnight-900">{label}</span>
        {why && <span className="block text-sm text-midnight-500">{why}</span>}
      </span>
    </button>
  );
}

export default function AddNeedSheet({ open, onClose, forceId, caseId, petName, onAdded, onTakeExisting }) {
  const [options, setOptions] = useState(null); // { places, shelters, suggestions, whens }
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null); // null: the list; else { mode: 'custom' | 'adjust', kind, placeId, shelterId, when, people, title, note }
  const [busy, setBusy] = useState(null); // which suggestion or 'form' is being added
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setForm(null);
    setError('');
    setDuplicate(null);
    setLoadError('');
    setOptions(null);
    fetch(`/api/rescue-forces/${forceId}/needs/options?caseId=${encodeURIComponent(caseId)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error || 'This did not load. Try again.');
        else setOptions(data);
      })
      .catch(() => !cancelled && setLoadError('This did not load. Check your connection.'));
    return () => {
      cancelled = true;
    };
  }, [open, forceId, caseId]);

  async function add(fields, key) {
    setBusy(key);
    setError('');
    setDuplicate(null);
    const { ok, status, data } = await post(`/api/rescue-forces/${forceId}/needs`, { caseId, ...fields });
    setBusy(null);
    if (ok) {
      onAdded(data.need);
      return;
    }
    if (status === 409 && data.duplicate) {
      setDuplicate({ ...data.duplicate, text: data.error, fields });
      if (!form) setForm({ mode: 'adjust', ...fields, title: '', note: fields.note || '' });
      return;
    }
    setError(data.error || 'That did not go through. Try again.');
  }

  const places = options?.places || [];
  const shelters = options?.shelters || [];
  const whens = options?.whens || { today: 'Today', tonight: 'Tonight', tomorrow: 'Tomorrow', weekend: 'This weekend' };

  function startForm(fields) {
    setError('');
    setDuplicate(null);
    setForm(fields);
  }

  const set = (patch) => {
    setError('');
    setDuplicate(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  function titleFor(f) {
    if (f.kind === 'other') return f.title;
    const suggestion = options?.suggestions?.find((s) => s.kind === f.kind);
    if (f.kind === 'shelter') {
      const shelter = shelters.find((s) => s.id === f.shelterId);
      return shelter ? `Check ${shelter.name}` : '';
    }
    const place = places.find((p) => p.id === f.placeId);
    if (!place) return suggestion?.title || '';
    const verb = { area: 'Search', doors: 'Knock on doors', flyers: 'Put up flyers' }[f.kind];
    return `${verb} near ${place.label}`;
  }

  let body;
  if (loadError) {
    body = (
      <p role="alert" className="text-red-700">
        {loadError}
      </p>
    );
  } else if (!options) {
    body = (
      <p className="flex items-center gap-2 text-midnight-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading
      </p>
    );
  } else if (!form) {
    body = (
      <>
        <p className="text-[15px] text-midnight-700">
          Most people pick one of these. Tap Add and it goes on {petName}&apos;s page.
        </p>
        <h3 className="mt-4 text-xs font-extrabold uppercase tracking-wide text-midnight-500">Suggested for {petName}</h3>
        <ul className="mt-2 space-y-2">
          {options.suggestions.map((s) => {
            const Icon = KIND_ICON[s.kind] || Pencil;
            const key = `${s.kind}:${s.placeId || s.shelterId}`;
            return (
              <li key={key} className="rounded-2xl border-2 border-midnight-100 bg-white p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-midnight-100 text-midnight-800" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug text-midnight-900">{s.title}</p>
                    <p className="mt-0.5 text-sm text-midnight-600">
                      {[whens[s.when], peopleText(s.people), s.why].filter(Boolean).join(' · ')}
                    </p>
                    {s.added ? (
                      <p className="mt-2 text-sm font-semibold text-midnight-500">Already added</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <button
                          type="button"
                          onClick={() => add({ kind: s.kind, placeId: s.placeId, shelterId: s.shelterId, when: s.when, people: s.people }, key)}
                          disabled={busy !== null}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 disabled:opacity-60"
                        >
                          {busy === key && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => startForm({ mode: 'adjust', kind: s.kind, placeId: s.placeId || null, shelterId: s.shelterId || null, when: s.when, people: s.people, title: '', note: '' })}
                          className={TEXT_BUTTON}
                        >
                          Change details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-4 text-[15px] text-midnight-700">
          Need something else?{' '}
          <button
            type="button"
            onClick={() => startForm({ mode: 'custom', kind: 'other', placeId: places[0]?.id || null, shelterId: null, when: 'today', people: 1, title: '', note: '' })}
            className={TEXT_BUTTON}
          >
            Write your own
          </button>
        </p>
      </>
    );
  } else {
    const shelterKind = form.kind === 'shelter';
    const title = titleFor(form);
    const submit = (e) => {
      e.preventDefault();
      add(
        {
          kind: form.kind,
          placeId: shelterKind ? null : form.placeId,
          shelterId: shelterKind ? form.shelterId : null,
          when: form.when,
          people: form.people,
          title: form.kind === 'other' ? form.title : undefined,
          note: form.note,
        },
        'form'
      );
    };
    body = (
      <form method="post" onSubmit={submit} noValidate>
        <h3 className="font-bold text-midnight-900">{form.mode === 'custom' ? 'Write your own' : 'Change the details'}</h3>

        {form.mode === 'custom' ? (
          <div className="mt-3">
            <label htmlFor="need-title" className="block text-sm font-bold text-midnight-800">
              What needs doing?
            </label>
            <input
              id="need-title"
              value={form.title}
              maxLength={80}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Walk the trail by the creek at dusk"
              className="mt-1 h-11 w-full rounded-xl border-2 border-midnight-200 px-3 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
            />
          </div>
        ) : (
          <p className="mt-2 font-semibold text-midnight-800">{title}</p>
        )}

        {shelterKind ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-bold text-midnight-800">Which shelter?</legend>
            <div className="mt-2 space-y-2" role="radiogroup">
              {shelters.map((s) => (
                <Choice key={s.id} on={form.shelterId === s.id} onPick={() => set({ shelterId: s.id })} label={s.name} why={s.why} />
              ))}
            </div>
          </fieldset>
        ) : (
          places.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-bold text-midnight-800">Where?</legend>
              <div className="mt-2 space-y-2" role="radiogroup">
                {places.map((p) => (
                  <Choice key={p.id} on={form.placeId === p.id} onPick={() => set({ placeId: p.id })} label={p.label} why={p.why} />
                ))}
                {form.kind === 'other' && (
                  <Choice on={!form.placeId} onPick={() => set({ placeId: null })} label="No place in particular" />
                )}
              </div>
            </fieldset>
          )
        )}

        <fieldset className="mt-4">
          <legend className="text-sm font-bold text-midnight-800">When?</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(whens).map(([key, label]) => {
              const on = form.when === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ when: key })}
                  className={`${CHIP} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-700 hover:border-midnight-300'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4">
          <p id="need-people-label" className="text-sm font-bold text-midnight-800">
            How many people?
          </p>
          <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="need-people-label">
            <button
              type="button"
              onClick={() => set({ people: Math.max(1, form.people - 1) })}
              disabled={form.people <= 1}
              aria-label="Fewer people"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-midnight-200 text-midnight-800 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[6rem] text-center font-bold text-midnight-900" aria-live="polite">
              {peopleText(form.people)}
            </span>
            <button
              type="button"
              onClick={() => set({ people: Math.min(20, form.people + 1) })}
              disabled={form.people >= 20}
              aria-label="More people"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-midnight-200 text-midnight-800 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="need-note" className="block text-sm font-bold text-midnight-800">
            Anything people should know? You can skip this.
          </label>
          <textarea
            id="need-note"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            rows={2}
            placeholder="Bring treats. Park by the library."
            className="mt-1 w-full resize-y rounded-xl border-2 border-midnight-200 px-3 py-2 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
          />
          <p className={`mt-0.5 text-right text-xs ${form.note.length > NOTE_MAX ? 'font-bold text-red-700' : 'text-midnight-500'}`}>
            {form.note.length} / {NOTE_MAX}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {duplicate && (
          <div role="alert" className="mt-3 rounded-xl bg-flash-50 p-3 ring-1 ring-flash-300">
            <p className="text-sm text-midnight-800">{duplicate.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {onTakeExisting && (
                <button
                  type="button"
                  onClick={() => onTakeExisting(duplicate.id)}
                  className="inline-flex h-10 items-center rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900"
                >
                  Sign up for that one instead
                </button>
              )}
              <button type="button" onClick={() => add({ ...duplicate.fields, anyway: true }, 'form')} className={TEXT_BUTTON}>
                Add mine anyway
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button
            type="submit"
            disabled={busy !== null || (form.kind === 'other' && !form.title.trim())}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-flash-400 px-5 font-bold text-midnight-900 disabled:opacity-60"
          >
            {busy === 'form' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Add need
          </button>
          <button type="button" onClick={() => setForm(null)} className={TEXT_BUTTON}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add a need for ${petName}`} maxWidth="max-w-lg">
      {body}
    </Modal>
  );
}
