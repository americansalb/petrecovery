'use client';

/**
 * "Write to the group": what the post is about (a topic), which pet if
 * any, a search party's time and place, the text, and a photo. The prompt
 * in the box changes with the topic, so a sighting asks where and when.
 */

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { send, TOPIC_LABEL } from './DiscussionPost';

const PROMPTS = {
  SIGHTING: 'Where and when did you see the pet? Which way was it going?',
  SEARCH_PARTY: 'Anything people should know? What to bring, who to look for.',
  QUESTION: 'What do you want to ask?',
  FLYERS: 'Where did you put up flyers, or where are they still needed?',
  HELLO: 'Say hello. Which part of town are you in, and how can you help?',
  '': 'Write something to the group',
};

const CHIP =
  'inline-flex h-10 items-center rounded-full border-2 px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

/** "2026-09-30T09:00" for a datetime-local field, from a local time. */
function localInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Composer({ open, onClose, forceId, pets, start, onPosted }) {
  const [topic, setTopic] = useState('');
  const [petId, setPetId] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Opened from a topic or a pet ("Post a sighting", a pet's row): start there.
  useEffect(() => {
    if (!open) return;
    setTopic(start?.topic || '');
    setPetId(start?.petId || '');
    setError('');
  }, [open, start]);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo]);

  const party = topic === 'SEARCH_PARTY';
  const ready = content.trim() && (!party || (when && where.trim()));

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      let imageUrl;
      if (photo) {
        const form = new FormData();
        form.append('file', photo.file);
        form.append('context', 'general');
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || 'The photo did not upload. Try a smaller one.');
        imageUrl = data.url;
      }
      await send(`/api/rescue-forces/${forceId}/posts`, {
        content: content.trim(),
        imageUrl,
        topic: topic || null,
        caseId: petId || null,
        ...(party ? { eventAt: new Date(when).toISOString(), eventPlace: where.trim() } : {}),
      });
      setContent('');
      setWhen('');
      setWhere('');
      setPhoto(null);
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Write to the group" maxWidth="max-w-lg">
      <form method="post" onSubmit={submit} noValidate>
        <fieldset>
          <legend className="text-sm font-bold text-midnight-800">What is it about?</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...Object.keys(TOPIC_LABEL), ''].map((key) => {
              const on = topic === key;
              return (
                <button
                  key={key || 'other'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTopic(key)}
                  className={`${CHIP} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-700 hover:border-midnight-300'}`}
                >
                  {key ? TOPIC_LABEL[key] : 'Something else'}
                </button>
              );
            })}
          </div>
        </fieldset>

        {pets.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-bold text-midnight-800">Which pet?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[{ id: '', name: 'No pet in particular' }, ...pets].map((p) => {
                const on = petId === p.id;
                return (
                  <button
                    key={p.id || 'none'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPetId(p.id)}
                    className={`${CHIP} ${on ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-200 bg-white text-midnight-700 hover:border-midnight-300'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {party && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="party-when" className="block text-sm font-bold text-midnight-800">
                When
              </label>
              <input
                id="party-when"
                type="datetime-local"
                value={when}
                min={localInput(new Date())}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border-2 border-midnight-200 px-3 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
              />
            </div>
            <div>
              <label htmlFor="party-where" className="block text-sm font-bold text-midnight-800">
                Where to meet
              </label>
              <input
                id="party-where"
                value={where}
                maxLength={140}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Zilker Park, main parking lot"
                className="mt-1 h-11 w-full rounded-xl border-2 border-midnight-200 px-3 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
              />
            </div>
          </div>
        )}

        <label htmlFor="post-body" className="sr-only">
          Your post
        </label>
        <textarea
          id="post-body"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={PROMPTS[topic]}
          className="mt-4 w-full resize-y rounded-xl border-2 border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
        />

        {photo && (
          <div className="relative mt-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="Photo to post" className="h-28 w-28 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              aria-label="Remove the photo"
              className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-midnight-900 text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-3 text-sm text-midnight-500">Only members of this Rescue Force see posts. Don&apos;t post anyone&apos;s home address.</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhoto({ file, preview: URL.createObjectURL(file) });
              e.target.value = '';
            }}
          />
          <Button type="button" variant="ghost" size="sm" leftIcon={ImagePlus} onClick={() => fileRef.current?.click()}>
            {photo ? 'Change photo' : 'Add a photo'}
          </Button>
          <Button type="submit" loading={busy} disabled={!ready}>
            Post
          </Button>
        </div>
      </form>
    </Modal>
  );
}
