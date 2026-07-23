'use client';

/**
 * The one client island on the otherwise server-rendered public shelter
 * page: a structured "ask about an animal" form that lands in the
 * shelter's portal inbox instead of a shared email account. The
 * per-animal cards anchor down here (#ask).
 */

import { useState } from 'react';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

const inputClass =
  'w-full border border-midnight-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400';

export default function InquirySection({ shelterId, shelterName, animals }) {
  const [form, setForm] = useState({ petId: '', name: '', email: '', phone: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/shelters/${shelterId}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, petId: form.petId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send your message');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div id="ask" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <p className="font-bold text-midnight-900">Message sent</p>
        <p className="text-sm text-midnight-600 mt-1">
          {shelterName} has your message and will reply to {form.email}.
        </p>
      </div>
    );
  }

  return (
    <div id="ask" className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6 scroll-mt-24">
      <h2 className="text-lg font-bold text-midnight-900 mb-1">Ask about an animal</h2>
      <p className="text-sm text-midnight-600 mb-4">
        Your message goes straight to the {shelterName} team; they&rsquo;ll reply by email.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="inq-name" className="block text-sm font-semibold text-midnight-800 mb-1">Your name</label>
            <input id="inq-name" required minLength={2} maxLength={100} value={form.name} onChange={set('name')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="inq-pet" className="block text-sm font-semibold text-midnight-800 mb-1">About</label>
            <select id="inq-pet" value={form.petId} onChange={set('petId')} className={`${inputClass} bg-white`}>
              <option value="">General question</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inq-email" className="block text-sm font-semibold text-midnight-800 mb-1">Email</label>
            <input id="inq-email" type="email" required value={form.email} onChange={set('email')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="inq-phone" className="block text-sm font-semibold text-midnight-800 mb-1">
              Phone <span className="font-normal text-midnight-400">(optional)</span>
            </label>
            <input id="inq-phone" type="tel" maxLength={30} value={form.phone} onChange={set('phone')} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="inq-message" className="block text-sm font-semibold text-midnight-800 mb-1">Message</label>
          <textarea
            id="inq-message"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={form.message}
            onChange={set('message')}
            placeholder="Tell the shelter about your home, other pets, and what you're looking for."
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2 rounded-xl disabled:opacity-60 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send message
        </button>
      </form>
    </div>
  );
}
