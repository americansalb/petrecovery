'use client';

/**
 * "Your public page" card on the shelter dashboard. Five fields and a
 * save button: mission, about, logo, cover photo, social links. Writes
 * ShelterProfile via /api/shelter/profile; the public page at
 * /shelters/[id] reads live data, so edits show immediately.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe2, Loader2, Save, ExternalLink } from 'lucide-react';
import ImageUpload from '@/app/components/ImageUpload';

const inputClass =
  'w-full border border-midnight-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400';

export default function ShelterProfileEditor({ shelterId }) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    mission: '', about: '', facebookUrl: '', instagramUrl: '', twitterUrl: '',
  });
  const [logo, setLogo] = useState([]);
  const [cover, setCover] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => {
    let alive = true;
    fetch('/api/shelter/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const p = d.profile || {};
        setForm({
          mission: p.mission || '',
          about: p.about || '',
          facebookUrl: p.facebookUrl || '',
          instagramUrl: p.instagramUrl || '',
          twitterUrl: p.twitterUrl || '',
        });
        if (p.logoUrl) setLogo([{ url: p.logoUrl }]);
        if (p.coverPhotoUrl) setCover([{ url: p.coverPhotoUrl }]);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shelter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          logoUrl: logo[0]?.url || '',
          coverPhotoUrl: cover[0]?.url || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMessage({ ok: true, text: 'Saved. Your public page is live.' });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-lg font-bold text-midnight-900 inline-flex items-center gap-2">
          <Globe2 className="w-5 h-5" /> Your public page
        </h2>
        <Link
          href={`/shelters/${shelterId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-700 hover:text-midnight-900 underline"
        >
          View public page <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
      <p className="text-sm text-midnight-600 mb-4">
        Your free page shows your adoptable animals and contact info. No website needed.
      </p>

      <form onSubmit={save} className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-5 space-y-4">
        <div>
          <label htmlFor="sp-mission" className="block text-sm font-semibold text-midnight-800 mb-1">
            Mission <span className="font-normal text-midnight-400">(one line)</span>
          </label>
          <input
            id="sp-mission"
            value={form.mission}
            onChange={set('mission')}
            maxLength={300}
            placeholder="Every animal deserves a warm bed and a second chance."
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sp-about" className="block text-sm font-semibold text-midnight-800 mb-1">
            About <span className="font-normal text-midnight-400">(optional)</span>
          </label>
          <textarea
            id="sp-about"
            value={form.about}
            onChange={set('about')}
            maxLength={4000}
            rows={4}
            placeholder="Tell adopters and neighbors who you are, your hours, and how to help."
            className={inputClass}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <ImageUpload
            images={logo}
            onUpload={(imgs) => setLogo(imgs.slice(-1))}
            onRemove={() => setLogo([])}
            maxImages={1}
            context="shelter"
            label="Logo"
            helpText="Square works best"
          />
          <ImageUpload
            images={cover}
            onUpload={(imgs) => setCover(imgs.slice(-1))}
            onRemove={() => setCover([])}
            maxImages={1}
            context="shelter"
            label="Cover photo"
            helpText="Wide photo for the top of your page"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <input
            aria-label="Facebook link"
            value={form.facebookUrl}
            onChange={set('facebookUrl')}
            placeholder="https://facebook.com/yourshelter"
            className={inputClass}
          />
          <input
            aria-label="Instagram link"
            value={form.instagramUrl}
            onChange={set('instagramUrl')}
            placeholder="https://instagram.com/yourshelter"
            className={inputClass}
          />
          <input
            aria-label="X link"
            value={form.twitterUrl}
            onChange={set('twitterUrl')}
            placeholder="https://x.com/yourshelter"
            className={inputClass}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2 rounded-xl disabled:opacity-60 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save page
        </button>
      </form>
    </div>
  );
}
