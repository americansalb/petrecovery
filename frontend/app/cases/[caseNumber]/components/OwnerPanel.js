'use client';

/**
 * The owner's own panel on the pet's page: where they are (the team sees
 * it beside the needs), a line for everyone helping, a better photo, the
 * phone finders call, and "Mark as reunited". Each tool uses the route
 * that owns it: the owner's status (POST /api/mission/[id]/owner), an
 * update (POST /api/missions/[id]/notes, shown under "What happened"),
 * the report itself (PATCH /api/missions/[id]), and the questionnaire
 * (DetailsHub: the same checklist as the report wizard, saved at once).
 */

import { useRef, useState } from 'react';
import { Camera, Check, HeartHandshake, Loader2, MessageSquare, Phone } from 'lucide-react';
import DetailsHub from '@/app/components/report/lost/DetailsHub';
import ScamNote from '@/app/components/report/ScamNote';

const STATUSES = [
  { id: 'SEARCHING', label: 'Out searching' },
  { id: 'AT_HOME', label: 'At home' },
  { id: 'AT_SHELTER', label: 'At a shelter' },
];

const CHIP =
  'inline-flex h-10 min-h-0 items-center rounded-full border-2 px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-60';
const DARK_INPUT =
  'min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[16px] text-white placeholder:text-midnight-400 focus:border-flash-400 focus:outline-none';
const DARK_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-4 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10 disabled:opacity-60';

async function send(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not go through. Try again in a moment.');
  return data;
}

export default function OwnerPanel({ caseId, name, phone, ownerStatus, species, details, breed, onChanged, onReunited }) {
  const [status, setStatus] = useState(ownerStatus || null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [update, setUpdate] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneText, setPhoneText] = useState(phone?.display || '');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  async function setWhere(id) {
    if (statusBusy) return;
    setStatusBusy(true);
    setError('');
    try {
      await send(`/api/mission/${caseId}/owner`, 'POST', { action: 'UPDATE_STATUS', activity: id });
      setStatus(id);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setStatusBusy(false);
    }
  }

  async function postUpdate() {
    const content = update.trim();
    if (!content || updateBusy) return;
    setUpdateBusy(true);
    setError('');
    try {
      await send(`/api/missions/${caseId}/notes`, 'POST', { content });
      setUpdate('');
      setPosted(true);
      setTimeout(() => setPosted(false), 3000);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdateBusy(false);
    }
  }

  async function addPhoto(file) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('context', 'pet');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'The photo did not upload. Try a smaller one.');
      await send(`/api/missions/${caseId}`, 'PATCH', { petPhotoUrl: data.url });
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function savePhone() {
    if (phoneBusy) return;
    setPhoneBusy(true);
    setError('');
    try {
      await send(`/api/missions/${caseId}`, 'PATCH', { ownerPhone: phoneText });
      setPhoneOpen(false);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setPhoneBusy(false);
    }
  }

  return (
    <section aria-labelledby="owner-heading" className="rounded-2xl bg-midnight-900 p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="owner-heading" className="font-semibold">This is your report</h2>
          <p className="text-sm text-midnight-300">Everyone helping sees what you put here. When {name} is home, mark it.</p>
        </div>
        <button type="button" onClick={onReunited} className={`${DARK_BUTTON} shrink-0`}>
          <HeartHandshake className="h-4 w-4" aria-hidden="true" />
          Mark as reunited
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-midnight-300">Where are you?</p>
        <div role="radiogroup" aria-label="Where you are" className="mt-2 flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const on = s.id === status;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={statusBusy}
                onClick={() => setWhere(s.id)}
                className={`${CHIP} ${on ? 'border-flash-400 bg-flash-400 text-midnight-900' : 'border-white/25 bg-transparent text-white hover:border-white/50'}`}
              >
                {on && <Check className="mr-1.5 h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <form
        method="post"
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          postUpdate();
        }}
      >
        <label htmlFor="owner-update" className="text-xs font-extrabold uppercase tracking-wide text-midnight-300">
          Tell everyone helping
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="owner-update"
            type="text"
            value={update}
            onChange={(e) => setUpdate(e.target.value)}
            maxLength={500}
            placeholder={`What helps someone find ${name}? What he answers to, where he hides.`}
            className={DARK_INPUT}
          />
          <button type="submit" disabled={updateBusy || !update.trim()} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-60">
            {updateBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : posted ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
            {posted ? 'Posted' : 'Post'}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          id="owner-photo"
          onChange={(e) => addPhoto(e.target.files?.[0])}
        />
        <label htmlFor="owner-photo" className={`${DARK_BUTTON} cursor-pointer`}>
          {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
          {photoBusy ? 'Uploading' : 'Add a better photo'}
        </label>
        <button type="button" onClick={() => setPhoneOpen((v) => !v)} className={DARK_BUTTON}>
          <Phone className="h-4 w-4" aria-hidden="true" />
          {phone ? 'Change the phone finders call' : 'Add a phone finders can call'}
        </button>
      </div>
      {phoneOpen && (
        <form
          method="post"
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            savePhone();
          }}
        >
          <label htmlFor="owner-phone" className="sr-only">Phone finders call</label>
          <input id="owner-phone" type="tel" value={phoneText} onChange={(e) => setPhoneText(e.target.value)} placeholder="(512) 555 0100" className={DARK_INPUT} />
          <button type="submit" disabled={phoneBusy} className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 hover:bg-flash-500 disabled:opacity-60">
            {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Save'}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-300">{error}</p>}

      <div className="mt-5 rounded-2xl bg-white p-2 text-midnight-900">
        <DetailsHub
          caseId={caseId}
          species={species}
          name={name}
          details={details}
          breed={breed}
          title="Details that help finders"
          intro={`Each one goes on ${name}'s flyer and this page. Skip what you don't know.`}
          onSaved={() => onChanged?.()}
        />
      </div>
      <div className="mt-3">
        <ScamNote compact />
      </div>
    </section>
  );
}
