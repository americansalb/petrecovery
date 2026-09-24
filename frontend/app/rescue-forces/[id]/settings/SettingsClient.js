'use client';

/**
 * The settings form. Everything except the photo saves together with one
 * button; the photo saves as soon as it is uploaded. A platform admin who is
 * not a leader can look but not save (the API only takes founders and
 * leaders), so the form is read-only for them.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Shield } from 'lucide-react';
import { Button } from '@/components/ui';

const GROUPS = [
  {
    title: 'Pets you search for',
    fields: [
      ['specializesInDogs', 'Dogs'],
      ['specializesInCats', 'Cats'],
      ['specializesInBirds', 'Birds'],
      ['specializesInOther', 'Other pets'],
    ],
  },
  {
    title: 'When members can search',
    fields: [
      ['availableWeekdays', 'Weekdays'],
      ['availableWeekends', 'Weekends'],
      ['availableDay', 'Daytime'],
      ['availableNight', 'At night'],
    ],
  },
  {
    title: 'Equipment',
    fields: [
      ['hasTrackingDogs', 'Tracking dogs'],
      ['hasDrones', 'Drones'],
    ],
  },
];

const FIELDS = ['description', 'isAcceptingCases', ...GROUPS.flatMap((g) => g.fields.map(([key]) => key))];

function Checkbox({ id, label, checked, onChange, disabled }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-midnight-200 has-[:checked]:bg-midnight-50 has-[:checked]:ring-midnight-400">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="h-4 w-4 rounded border-midnight-300" />
      <span className="text-midnight-800">{label}</span>
    </label>
  );
}

function PhotoSetting({ forceId, initialUrl, disabled }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  async function upload(file) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('context', 'general');
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) throw new Error(upData.error || 'The photo did not upload. Try a smaller one.');
      const res = await fetch(`/api/rescue-forces/${forceId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: upData.url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The photo did not save.');
      setUrl(data.photoUrl || upData.url);
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
      <h2 className="text-base font-semibold text-midnight-900">Photo</h2>
      <p className="mt-0.5 text-sm text-midnight-500">Shown on the force&apos;s page and when someone shares its link.</p>
      <div className="mt-3 flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="The force's photo" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-midnight-100 text-midnight-500">
            <Shield size={30} aria-hidden="true" />
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
        <Button variant="outline" leftIcon={Camera} loading={busy} disabled={disabled} onClick={() => fileRef.current?.click()}>
          {url ? 'Change photo' : 'Add a photo'}
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

export default function SettingsClient({ forceId, initial, canEdit }) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, k === 'description' ? initial[k] || '' : Boolean(initial[k])])));
  const [saved, setSaved] = useState(values);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // null | 'saved' | error message
  const dirty = FIELDS.some((k) => values[k] !== saved[k]);
  const set = (key) => (value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus(null);
  };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, description: values.description.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The settings did not save. Try again.');
      setSaved(values);
      setStatus('saved');
      router.refresh();
    } catch (err) {
      setStatus(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      {!canEdit && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
          Only this force&apos;s founder and leaders can change its settings.
        </p>
      )}
      <PhotoSetting forceId={forceId} initialUrl={initial.photoUrl || initial.logoUrl} disabled={!canEdit} />

      <form method="post" onSubmit={save} className="space-y-5">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
          <label htmlFor="force-description" className="font-semibold text-midnight-900">
            Description
          </label>
          <p className="mt-0.5 text-sm text-midnight-500">A few sentences on the force&apos;s page about who you are and where you search.</p>
          <textarea
            id="force-description"
            value={values.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={4}
            maxLength={1000}
            disabled={!canEdit}
            className="mt-3 w-full rounded-xl border border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
          />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
          <h2 className="text-base font-semibold text-midnight-900">New pets</h2>
          <div className="mt-3">
            <Checkbox
              id="isAcceptingCases"
              label="Take new lost-pet reports from this area"
              checked={values.isAcceptingCases}
              onChange={set('isAcceptingCases')}
              disabled={!canEdit}
            />
          </div>
          <p className="mt-2 text-sm text-midnight-500">Turn this off when the force can&apos;t take on more searches for now.</p>
        </section>

        {GROUPS.map((group) => (
          <section key={group.title} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
            <h2 className="text-base font-semibold text-midnight-900">{group.title}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.fields.map(([key, label]) => (
                <Checkbox key={key} id={key} label={label} checked={values[key]} onChange={set(key)} disabled={!canEdit} />
              ))}
            </div>
          </section>
        ))}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={busy} disabled={!dirty}>
              Save settings
            </Button>
            {status === 'saved' && (
              <p role="status" className="inline-flex items-center gap-1.5 text-emerald-700">
                <Check size={18} aria-hidden="true" />
                Saved
              </p>
            )}
            {status && status !== 'saved' && (
              <p role="alert" className="text-red-700">
                {status}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
