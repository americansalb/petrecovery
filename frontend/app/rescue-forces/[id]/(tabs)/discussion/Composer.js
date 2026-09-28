'use client';

/**
 * The box at the top of a force's Discussion: write, add a photo, post.
 * Tapping it opens the text box in place. The post can be about one of
 * the force's pets, and a leader can pin it to the top (that goes through
 * the announcements API, which is what the top of the Discussion shows).
 * "Plan a search" opens ./PlanSearchSheet.js.
 */

import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ImagePlus, Pin, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { Initial, send } from './DiscussionPost';

const FOOT = 'inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-midnight-600 transition hover:bg-midnight-50 hover:text-midnight-900';
const FIELD =
  'w-full rounded-xl border-2 border-midnight-200 px-3 py-2 text-midnight-900 outline-none placeholder:text-midnight-400 focus:border-midnight-400 focus:ring-2 focus:ring-flash-400';

/** A pinned post's first line, as its title: announcements need one. */
export function pinnedTitle(content) {
  const first = String(content || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}...` : first;
}

export default function Composer({ forceId, myName, pets, canPin, onPosted, onPlan }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [petId, setPetId] = useState('');
  const [pin, setPin] = useState(false);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);
  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo]);

  function close() {
    setOpen(false);
    setError('');
  }

  // A pinned post is an announcement: words only.
  function togglePin(on) {
    setPin(on);
    if (on) {
      setPhoto(null);
      setPetId('');
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (pin) {
        await send(`/api/rescue-forces/${forceId}/announcements`, { title: pinnedTitle(content), content: content.trim(), isPinned: true });
      } else {
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
        await send(`/api/rescue-forces/${forceId}/posts`, { content: content.trim(), imageUrl, caseId: petId || null });
      }
      setContent('');
      setPetId('');
      setPin(false);
      setPhoto(null);
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-3 ring-1 ring-midnight-200">
      <div className="flex items-start gap-3">
        <Initial name={myName} />
        {open ? (
          <textarea
            ref={boxRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Write something to the group"
            aria-label="Your post"
            className={`${FIELD} min-w-0 flex-1 resize-y`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-0 flex-1 rounded-full bg-midnight-50 px-4 py-2.5 text-left text-[15px] text-midnight-500 transition hover:bg-midnight-100"
          >
            Write something to the group
          </button>
        )}
      </div>

      {photo && (
        <div className="relative ml-[52px] mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="Photo to post" className="h-28 w-28 rounded-xl object-cover" />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            aria-label="Remove the photo"
            className="absolute -right-2 -top-2 inline-flex h-8 w-8 min-h-0 min-w-0 items-center justify-center rounded-full bg-midnight-900 text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {open && !pin && pets.length > 0 && (
        <label className="ml-[52px] mt-3 block text-sm font-semibold text-midnight-700">
          About a pet
          <select value={petId} onChange={(e) => setPetId(e.target.value)} className={`${FIELD} mt-1 h-11 bg-white py-0 font-normal`}>
            <option value="">No pet in particular</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {open && pin && <p className="ml-[52px] mt-3 text-sm text-midnight-600">Every member sees a pinned post at the top of the discussion.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setPhoto({ file, preview: URL.createObjectURL(file) });
            setOpen(true);
          }
          e.target.value = '';
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {!pin && (
          <button type="button" onClick={() => fileRef.current?.click()} className={FOOT}>
            <ImagePlus className="h-[18px] w-[18px]" aria-hidden="true" />
            {photo ? 'Change photo' : 'Photo'}
          </button>
        )}
        <button type="button" onClick={onPlan} className={FOOT}>
          <CalendarPlus className="h-[18px] w-[18px]" aria-hidden="true" />
          Plan a search
        </button>
        {open && canPin && (
          <label className={`${FOOT} cursor-pointer`}>
            <input type="checkbox" checked={pin} onChange={(e) => togglePin(e.target.checked)} className="h-4 w-4 rounded border-midnight-300" />
            <Pin className="h-4 w-4" aria-hidden="true" />
            Pin to the top
          </label>
        )}
        {open && (
          <span className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={busy} disabled={!content.trim()}>
              Post
            </Button>
          </span>
        )}
      </div>
    </form>
  );
}
