'use client';

/**
 * The correction request form: pick who it is about (or the letter
 * overall), say what is wrong, optionally leave a way to be reached.
 * Submits to /api/rasuwa/corrections; the task force board lists what
 * comes in. ?for=<num> preselects a person, so the wizard and the
 * chart can hand off with the person already picked.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import missingPeople from '../missing-people.json';
import { CORRECTION_CAPS } from '../corrections';

const PEOPLE = missingPeople.people;
const PEOPLE_ALPHA = [...PEOPLE].sort((a, b) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
);

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700';

export default function CorrectionForm() {
  const [personName, setPersonName] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const forNum = Number(new URLSearchParams(window.location.search).get('for'));
    const entry = Number.isFinite(forNum) ? PEOPLE.find((p) => p.num === forNum) : null;
    if (entry) setPersonName(entry.name);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rasuwa/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personName, message, contact }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setSent(true);
      else if (res.status === 429) setError('A lot of requests are coming in. Wait a minute and try again.');
      else setError((data && data.error) || 'That did not send. Try again.');
    } catch {
      setError('That did not send. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="font-bold text-green-900">Sent. Thank you.</p>
        <p className="mt-1.5 text-sm text-green-900/80">
          The coordinating families review every request and correct the letter at its source.
          The site follows the letter, so a fix shows up here once the letter carries it.
        </p>
        <p className="mt-3 text-sm">
          <Link className="font-semibold text-blue-800 underline" href="/rasuwa">
            Write your letters to Congress
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Who is it about?</span>
        <select className={inputCls} value={personName} onChange={(e) => setPersonName(e.target.value)}>
          <option value="">The letter overall, or someone not listed</option>
          {PEOPLE_ALPHA.map((p) => (
            <option key={p.num} value={p.name}>{p.name}, {p.country}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          What is wrong, and what should it say instead?
        </span>
        <textarea
          className={`${inputCls} min-h-[120px]`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={CORRECTION_CAPS.message}
          placeholder="For example: the last known location should be Hotel Kailash, Timure, and the name is spelled Laxminath."
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          How can the families reach you? (optional)
        </span>
        <input
          className={inputCls}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={CORRECTION_CAPS.contact}
          placeholder="Phone or email, in case they have a question"
        />
      </label>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={!message.trim() || busy}
        className="inline-flex items-center justify-center rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-40"
      >
        {busy ? 'Sending...' : 'Send for review'}
      </button>
    </form>
  );
}
