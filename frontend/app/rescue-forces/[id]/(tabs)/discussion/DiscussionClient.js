'use client';

/**
 * A force's Discussion, laid out like a group: Latest (what leaders pinned,
 * search parties coming up, then every post, newest first) and Topics
 * (where to start, the pets, the kinds of post). On a phone they are two
 * views; on a computer Topics is the sidebar. Tapping a pet or a topic
 * shows only those posts until "Show all".
 *
 * APIs: GET .../posts (topic, caseId, before, upcoming), POST .../posts,
 * GET/POST .../announcements (leaders post; "Keep it at the top" pins).
 * The counts in Topics come from the page (app/lib/forceDiscussion.js)
 * and refresh after a post.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Megaphone, Pin, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { timeAgo } from '@/app/lib/caseLabels';
import DiscussionPost, { Initial, PostText, send } from './DiscussionPost';
import Composer from './Composer';
import TopicsPanel from './TopicsPanel';

function AnnouncementForm({ forceId, onPosted }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" leftIcon={Megaphone} onClick={() => setOpen(true)}>
        Post an announcement
      </Button>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await send(`/api/rescue-forces/${forceId}/announcements`, { title: title.trim(), content: content.trim(), isPinned: pinned });
      setTitle('');
      setContent('');
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
      <p className="font-bold text-midnight-900">New announcement</p>
      <p className="mt-0.5 text-sm text-midnight-500">Every member sees it at the top of the discussion.</p>
      <label htmlFor="ann-title" className="mt-3 block text-sm font-semibold text-midnight-800">
        Title
      </label>
      <input
        id="ann-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
        className="mt-1 w-full rounded-xl border-2 border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
      />
      <label htmlFor="ann-body" className="mt-3 block text-sm font-semibold text-midnight-800">
        Message
      </label>
      <textarea
        id="ann-body"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        required
        className="mt-1 w-full rounded-xl border-2 border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-midnight-700">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded border-midnight-300" />
        Keep it at the top
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="submit" loading={busy} disabled={!title.trim() || !content.trim()}>
          Post announcement
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Announcement({ a }) {
  return (
    <article className="rounded-2xl bg-flash-50 p-4 ring-1 ring-flash-300">
      <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-flash-900">
        {a.isPinned ? <Pin size={13} aria-hidden="true" /> : <Megaphone size={13} aria-hidden="true" />}
        {a.isPinned ? `Pinned by ${a.authorName}` : `Announcement from ${a.authorName}`}
      </p>
      <h3 className="mt-1 text-lg font-bold text-midnight-900">{a.title}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-[15px] text-midnight-800">
        <PostText text={a.content} />
      </p>
      <p className="mt-2 text-sm text-midnight-500">{timeAgo(a.createdAt)}</p>
    </article>
  );
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function DiscussionClient({ forceId, canPost, canAnnounce, myName, pets, summary }) {
  const router = useRouter();
  const [view, setView] = useState('latest'); // phone only: latest | topics
  const [filter, setFilter] = useState(null); // { topic?, caseId?, label }
  const [announcements, setAnnouncements] = useState([]);
  const [parties, setParties] = useState([]);
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | ready | failed
  const [older, setOlder] = useState(false);
  const [composer, setComposer] = useState(null); // null, or where it starts: { topic, petId }

  const query = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams({ sort: 'new' });
      if (filter?.topic) params.set('topic', filter.topic);
      if (filter?.caseId) params.set('caseId', filter.caseId);
      Object.entries(extra).forEach(([k, v]) => params.set(k, v));
      return `/api/rescue-forces/${forceId}/posts?${params}`;
    },
    [forceId, filter]
  );

  const load = useCallback(async () => {
    try {
      const [a, p, up] = await Promise.all([
        getJson(`/api/rescue-forces/${forceId}/announcements`),
        getJson(query()),
        filter ? Promise.resolve({ posts: [] }) : getJson(`/api/rescue-forces/${forceId}/posts?upcoming=1`),
      ]);
      setAnnouncements(
        (a.announcements || [])
          .filter((x) => !x.isSystemPost)
          .sort((x, y) => Number(y.isPinned) - Number(x.isPinned))
          .slice(0, 3)
      );
      setPosts(p.posts || []);
      setHasMore(Boolean(p.hasMore));
      setParties(up.posts || []);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [forceId, filter, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadOlder() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setOlder(true);
    try {
      const p = await getJson(query({ before: new Date(last.createdAt).toISOString() }));
      setPosts((prev) => [...prev, ...(p.posts || [])]);
      setHasMore(Boolean(p.hasMore));
    } catch {
      // The button stays; tapping it again tries again.
    }
    setOlder(false);
  }

  function changed() {
    load();
    router.refresh(); // the Topics counts
  }

  function pick(next) {
    setFilter(next);
    setView('latest');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const partyIds = new Set(parties.map((p) => p.id));
  const stream = filter ? posts : posts.filter((p) => !partyIds.has(p.id));

  const latest = (
    <div className="space-y-4">
      {canPost && (
        <button
          type="button"
          onClick={() => setComposer({ topic: filter?.topic || '', petId: filter?.caseId || '' })}
          className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-midnight-200 transition hover:ring-midnight-300"
        >
          <Initial name={myName} />
          <span className="flex-1 rounded-full bg-midnight-50 px-4 py-2.5 text-[15px] text-midnight-500">Write something to the group</span>
        </button>
      )}
      {canAnnounce && !filter && <AnnouncementForm forceId={forceId} onPosted={changed} />}

      {filter && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-midnight-900 px-4 py-2.5 text-white">
          <p className="min-w-0 truncate text-sm">
            Showing: <strong className="font-bold">{filter.label}</strong>
          </p>
          <button type="button" onClick={() => setFilter(null)} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">
            Show all
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {status === 'loading' ? (
        <p className="flex items-center gap-2 py-6 text-midnight-500" aria-busy="true">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Loading the discussion
        </p>
      ) : status === 'failed' ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
          <p className="text-midnight-700">The discussion did not load.</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => { setStatus('loading'); load(); }}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {!filter && announcements.length > 0 && (
            <section aria-label="Pinned" className="space-y-3">
              {announcements.map((a) => (
                <Announcement key={a.id} a={a} />
              ))}
            </section>
          )}

          {!filter && parties.length > 0 && (
            <section aria-labelledby="coming-up" className="space-y-3">
              <h2 id="coming-up" className="text-xs font-extrabold uppercase tracking-wider text-midnight-500">
                Coming up
              </h2>
              {parties.map((post) => (
                <DiscussionPost key={post.id} post={post} forceId={forceId} canPost={canPost} onChanged={changed} onFilterPet={(p) => pick({ caseId: p.id, label: p.name })} />
              ))}
            </section>
          )}

          {stream.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-8 text-center ring-1 ring-midnight-200">
              <p className="font-semibold text-midnight-900">{filter ? `No posts about ${filter.label} yet` : 'No posts yet'}</p>
              {canPost && (
                <button
                  type="button"
                  onClick={() => setComposer({ topic: filter?.topic || '', petId: filter?.caseId || '' })}
                  className="mt-2 text-sm font-bold text-midnight-800 underline underline-offset-4"
                >
                  Write the first one
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {stream.map((post) => (
                <DiscussionPost key={post.id} post={post} forceId={forceId} canPost={canPost} onChanged={changed} onFilterPet={(p) => pick({ caseId: p.id, label: p.name })} />
              ))}
            </div>
          )}

          {hasMore && (
            <Button variant="outline" fullWidth onClick={loadOlder} loading={older}>
              Show older posts
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:pb-10 lg:pt-6">
      {/* Phone: Latest and Topics are two views. */}
      <div role="group" aria-label="Show" className="mb-4 grid grid-cols-2 rounded-xl bg-midnight-100 p-1 lg:hidden">
        {[
          ['latest', 'Latest'],
          ['topics', 'Topics'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`h-10 rounded-lg text-sm font-bold transition ${view === key ? 'bg-white text-midnight-900 shadow-sm' : 'text-midnight-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={view === 'latest' ? '' : 'hidden lg:block'}>{latest}</div>

      <aside className={`${view === 'topics' ? '' : 'hidden'} lg:block`}>
        <div className="lg:sticky lg:top-[131px] lg:rounded-2xl lg:bg-white lg:p-4 lg:ring-1 lg:ring-midnight-200">
          <TopicsPanel summary={summary} onFilter={pick} />
        </div>
      </aside>

      <Composer
        open={Boolean(composer)}
        onClose={() => setComposer(null)}
        forceId={forceId}
        pets={pets}
        start={composer}
        onPosted={() => {
          setComposer(null);
          changed();
        }}
      />
    </div>
  );
}
