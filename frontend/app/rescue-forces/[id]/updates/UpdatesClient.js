'use client';

/**
 * The Updates tab: leaders' announcements on top, then a box to post and the
 * posts themselves, each with a like and comments.
 *
 * APIs: GET/POST /api/rescue-forces/[id]/announcements (posting needs a
 * founder, leader or coordinator), GET/POST .../posts, POST
 * .../posts/[postId]/vote (1 likes, 0 takes the like back), POST
 * .../posts/[postId]/comments ({ content, parentCommentId }), POST
 * .../comments/[commentId]/vote, and POST /api/upload for a photo.
 *
 * The canned welcome announcement the old hub created for every force is
 * left out (isSystemPost): it was generic copy no leader wrote.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, ImagePlus, X, Megaphone, Pin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { timeAgo } from '@/app/lib/caseLabels';
import { FORCE_ROLE_LABEL } from '@/app/lib/forceRoles';

async function send(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not go through. Try again.');
  return data;
}

// A case number ("AUS-2026-7KQ4MX", older "AUS-2026-0001") in a post links
// to that pet's page: the automatic post for a new report ends with one.
const CASE_NUMBER = /(#?\b[A-Z]{3,4}-\d{4}-[0-9A-Z]{4,6}\b)/;

function withCaseLinks(text) {
  return text.split(new RegExp(CASE_NUMBER.source, 'g')).map((part, i) =>
    CASE_NUMBER.test(part) ? (
      <Link key={i} href={`/cases/${part.replace('#', '')}`} className="font-medium text-midnight-900 underline underline-offset-2">
        {part.replace('#', '')}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/** Post and comment text. Older automatic posts wrapped words in **. */
function PostText({ text }) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{withCaseLinks(part.slice(2, -2))}</strong> : <Fragment key={i}>{withCaseLinks(part)}</Fragment>
    );
}

function Byline({ name, role, date, division }) {
  const label = role && role !== 'MEMBER' ? FORCE_ROLE_LABEL[role] : null;
  return (
    <p className="text-sm text-midnight-500">
      <span className="font-semibold text-midnight-800">{name}</span>
      {label && <span className="ml-1.5 rounded-full bg-midnight-100 px-2 py-0.5 text-xs font-semibold text-midnight-600">{label}</span>}
      {division && <span> · {division}</span>}
      {date && <span> · {timeAgo(date)}</span>}
    </p>
  );
}

function AnnouncementForm({ forceId, onPosted }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <Button variant="outline" leftIcon={Megaphone} onClick={() => setOpen(true)}>
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
      setPinned(false);
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
      <p className="font-semibold text-midnight-900">New announcement</p>
      <p className="mt-0.5 text-sm text-midnight-500">Every member sees announcements at the top of Updates.</p>
      <label htmlFor="ann-title" className="mt-4 block text-sm font-medium text-midnight-800">
        Title
      </label>
      <input
        id="ann-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
        className="mt-1 w-full rounded-xl border border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
      />
      <label htmlFor="ann-body" className="mt-3 block text-sm font-medium text-midnight-800">
        Message
      </label>
      <textarea
        id="ann-body"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        required
        className="mt-1 w-full rounded-xl border border-midnight-200 px-3 py-2.5 text-midnight-900 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-midnight-700">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded border-midnight-300" />
        Keep it at the top
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
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
    <article className="rounded-2xl bg-flash-50 p-4 ring-1 ring-flash-200 sm:p-5">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-flash-800">
        {a.isPinned ? <Pin size={13} aria-hidden="true" /> : <Megaphone size={13} aria-hidden="true" />}
        Announcement
      </p>
      <h3 className="mt-1 text-lg font-semibold text-midnight-900">{a.title}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-midnight-800">
        <PostText text={a.content} />
      </p>
      <div className="mt-2">
        <Byline name={a.authorName} date={a.createdAt} />
      </div>
    </article>
  );
}

function PostBox({ forceId, onPosted }) {
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo]);

  async function submit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
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
      await send(`/api/rescue-forces/${forceId}/posts`, { content: content.trim(), imageUrl });
      setContent('');
      setPhoto(null);
      onPosted();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form method="post" onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
      <label htmlFor="post-body" className="sr-only">
        Write a post
      </label>
      <textarea
        id="post-body"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Share a sighting, a search plan, or a question"
        className="w-full resize-y rounded-xl border border-midnight-200 px-3 py-2.5 text-midnight-900 placeholder:text-midnight-400 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
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
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
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
        <Button type="submit" loading={busy} disabled={!content.trim()}>
          Post
        </Button>
      </div>
    </form>
  );
}

function LikeButton({ liked, count, onToggle, small = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 font-medium transition ${small ? 'text-xs' : 'text-sm'} ${
        liked ? 'text-rose-600' : 'text-midnight-500 hover:text-midnight-800'
      }`}
    >
      <Heart size={small ? 14 : 17} className={liked ? 'fill-rose-600' : ''} aria-hidden="true" />
      {count > 0 ? count : ''}
      <span className="sr-only">{liked ? 'Unlike' : 'Like'}</span>
    </button>
  );
}

/** Like state that updates at once and goes back if the server says no. */
function useLike(initialLiked, initialCount, url) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const busy = useRef(false);
  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const data = await send(url, { vote: next ? 1 : 0 });
      if (typeof data.upvotes === 'number') setCount(data.upvotes);
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
    busy.current = false;
  }
  return { liked, count, toggle };
}

function Comment({ c, forceId, depth, onReply }) {
  const like = useLike(c.userVote === 1, c.upvotes || 0, `/api/rescue-forces/${forceId}/comments/${c.id}/vote`);
  return (
    <li>
      <div className="rounded-xl bg-midnight-50 px-3 py-2">
        <Byline name={c.authorName} role={c.authorRole} date={c.createdAt} />
        <p className="mt-0.5 whitespace-pre-line break-words text-midnight-800">
          <PostText text={c.content} />
        </p>
      </div>
      <div className="mt-0.5 flex items-center gap-1 pl-1">
        <LikeButton small liked={like.liked} count={like.count} onToggle={like.toggle} />
        {/* The feed loads three levels of comments; replies stop there. */}
        {depth < 2 && (
          <button type="button" onClick={() => onReply(c)} className="rounded-full px-2 text-xs font-medium text-midnight-500 hover:text-midnight-800">
            Reply
          </button>
        )}
      </div>
      {c.replies?.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-midnight-100 pl-3">
          {c.replies.map((r) => (
            <Comment key={r.id} c={r} forceId={forceId} depth={depth + 1} onReply={onReply} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Every comment and reply loaded. The post's commentCount counts only top-level comments. */
function countComments(comments = []) {
  return comments.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

function Post({ post, forceId, canPost, onChanged }) {
  const like = useLike(post.userVote === 1, post.upvotes || 0, `/api/rescue-forces/${forceId}/posts/${post.id}/vote`);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputId = `comment-${post.id}`;

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await send(`/api/rescue-forces/${forceId}/posts/${post.id}/comments`, {
        content: text.trim(),
        parentCommentId: replyTo?.id,
      });
      setText('');
      setReplyTo(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
      <Byline name={post.authorName} role={post.authorRole} date={post.createdAt} division={post.divisionName} />
      {post.title && <h3 className="mt-2 text-base font-semibold text-midnight-900">{post.title}</h3>}
      <p className="mt-1.5 whitespace-pre-line break-words text-midnight-800">
        <PostText text={post.content} />
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-[28rem] w-full rounded-xl object-cover" />
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-midnight-100 pt-2">
        <LikeButton liked={like.liked} count={like.count} onToggle={like.toggle} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full px-2 text-sm font-medium text-midnight-500 hover:text-midnight-800"
        >
          <MessageCircle size={17} aria-hidden="true" />
          {(() => {
            const n = post.comments ? countComments(post.comments) : post.commentCount || 0;
            return n > 0 ? `${n} ${n === 1 ? 'comment' : 'comments'}` : 'Comment';
          })()}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {post.comments?.length > 0 && (
            <ul className="space-y-2">
              {post.comments.map((c) => (
                <Comment
                  key={c.id}
                  c={c}
                  forceId={forceId}
                  depth={0}
                  onReply={(target) => {
                    setReplyTo(target);
                    document.getElementById(inputId)?.focus();
                  }}
                />
              ))}
            </ul>
          )}
          {canPost && (
            <form method="post" onSubmit={submit}>
              {replyTo && (
                <p className="mb-1 flex items-center gap-2 text-xs text-midnight-500">
                  Replying to {replyTo.authorName}
                  <button type="button" onClick={() => setReplyTo(null)} className="font-medium text-midnight-700 underline">
                    Cancel
                  </button>
                </p>
              )}
              <div className="flex gap-2">
                <label htmlFor={inputId} className="sr-only">
                  Write a comment
                </label>
                <input
                  id={inputId}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a comment"
                  className="min-w-0 flex-1 rounded-xl border border-midnight-200 px-3 py-2 text-midnight-900 placeholder:text-midnight-400 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
                />
                <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>
                  Send
                </Button>
              </div>
              {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export default function UpdatesClient({ forceId, canPost, canAnnounce }) {
  const [announcements, setAnnouncements] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('new');
  const [status, setStatus] = useState('loading'); // loading | ready | failed

  const load = useCallback(async () => {
    try {
      const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
      const [a, p] = await Promise.all([
        get(`/api/rescue-forces/${forceId}/announcements`),
        get(`/api/rescue-forces/${forceId}/posts?sort=${sort}`),
      ]);
      setAnnouncements((a.announcements || []).filter((x) => !x.isSystemPost).sort((x, y) => Number(y.isPinned) - Number(x.isPinned)));
      setPosts(p.posts || []);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [forceId, sort]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-midnight-500" aria-busy="true">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Loading updates
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
        <p className="text-midnight-700">The updates did not load.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => { setStatus('loading'); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canAnnounce && <AnnouncementForm forceId={forceId} onPosted={load} />}

      {announcements.length > 0 && (
        <section aria-label="Announcements" className="space-y-3">
          {announcements.map((a) => (
            <Announcement key={a.id} a={a} />
          ))}
        </section>
      )}

      {canPost && <PostBox forceId={forceId} onPosted={load} />}

      <section aria-labelledby="posts-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="posts-heading" className="text-lg font-semibold text-midnight-900">
            Posts
          </h2>
          {posts.length > 1 && (
            <div role="group" aria-label="Sort posts" className="flex rounded-full bg-white p-0.5 ring-1 ring-midnight-200">
              {[
                ['new', 'Newest'],
                ['top', 'Most liked'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                  className={`rounded-full px-3 text-sm font-medium ${sort === key ? 'bg-midnight-900 text-white' : 'text-midnight-600 hover:text-midnight-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {posts.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
            No posts yet.{canPost ? ' Posts you write here are seen by this force’s members only.' : ''}
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {posts.map((post) => (
              <Post key={post.id} post={post} forceId={forceId} canPost={canPost} onChanged={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
