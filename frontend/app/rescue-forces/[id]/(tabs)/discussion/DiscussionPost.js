'use client';

/**
 * One post in a force's Discussion: who wrote it and when, what it is
 * about (a topic and a pet), a search party's time and place with who is
 * going, the text and photo, "Helpful", and the comments.
 *
 * APIs: POST .../posts/[postId]/vote (1 marks it helpful, 0 takes that
 * back), .../posts/[postId]/comments ({ content, parentCommentId }),
 * .../comments/[commentId]/vote, .../posts/[postId]/going ({ going }).
 */

import { Fragment, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, MessageCircle, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui';
import { timeAgo } from '@/app/lib/caseLabels';
import { FORCE_ROLE_LABEL } from '@/app/lib/forceRoles';
import PetStatusDot from '@/app/components/PetStatusDot';

export const TOPIC_LABEL = {
  SIGHTING: 'Sighting',
  SEARCH_PARTY: 'Search party',
  QUESTION: 'Question',
  FLYERS: 'Flyers',
  HELLO: 'Say hello',
};

const TOPIC_STYLE = {
  SIGHTING: 'bg-orange-100 text-orange-800',
  SEARCH_PARTY: 'bg-midnight-900 text-white',
};

export async function send(url, body) {
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
export function PostText({ text }) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{withCaseLinks(part.slice(2, -2))}</strong> : <Fragment key={i}>{withCaseLinks(part)}</Fragment>
    );
}

export function Initial({ name, size = 'h-10 w-10 text-base' }) {
  return (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-midnight-900 font-extrabold text-white`} aria-hidden="true">
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function roleLabel(role) {
  return role && role !== 'MEMBER' ? FORCE_ROLE_LABEL[role] : null;
}

/** "Saturday, 9 am", "Tuesday, 6:30 pm", in the reader's own time zone. */
export function partyWhen(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${day}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** Helpful state that updates at once and goes back if the server says no. */
function useHelpful(initial, initialCount, url) {
  const [on, setOn] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const busy = useRef(false);
  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    const next = !on;
    setOn(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const data = await send(url, { vote: next ? 1 : 0 });
      if (typeof data.upvotes === 'number') setCount(data.upvotes);
    } catch {
      setOn(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
    busy.current = false;
  }
  return { on, count, toggle };
}

function HelpfulButton({ helpful, small = false }) {
  return (
    <button
      type="button"
      onClick={helpful.toggle}
      aria-pressed={helpful.on}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 font-semibold transition ${small ? 'text-xs' : 'text-sm'} ${
        helpful.on ? 'text-midnight-900' : 'text-midnight-500 hover:text-midnight-800'
      }`}
    >
      <ThumbsUp size={small ? 14 : 16} className={helpful.on ? 'fill-flash-400' : ''} aria-hidden="true" />
      Helpful{helpful.count > 0 ? ` (${helpful.count})` : ''}
    </button>
  );
}

function Comment({ c, forceId, depth, onReply }) {
  const helpful = useHelpful(c.userVote === 1, c.upvotes || 0, `/api/rescue-forces/${forceId}/comments/${c.id}/vote`);
  const role = roleLabel(c.authorRole);
  return (
    <li>
      <div className="flex gap-2">
        <Initial name={c.authorName} size="h-7 w-7 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-midnight-50 px-3 py-2">
            <p className="text-sm font-bold text-midnight-900">
              {c.authorName}
              {role && <span className="ml-1.5 font-semibold text-midnight-500">{role}</span>}
            </p>
            <p className="whitespace-pre-line break-words text-[15px] text-midnight-800">
              <PostText text={c.content} />
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="px-2 text-xs text-midnight-500">{timeAgo(c.createdAt)}</span>
            <HelpfulButton small helpful={helpful} />
            {/* The feed loads three levels of comments; replies stop there. */}
            {depth < 2 && (
              <button type="button" onClick={() => onReply(c)} className="rounded-full px-2 text-xs font-semibold text-midnight-500 hover:text-midnight-800">
                Reply
              </button>
            )}
          </div>
          {c.replies?.length > 0 && (
            <ul className="mt-2 space-y-2">
              {c.replies.map((r) => (
                <Comment key={r.id} c={r} forceId={forceId} depth={depth + 1} onReply={onReply} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/** Every comment and reply loaded. The post's commentCount counts only top-level comments. */
function countComments(comments = []) {
  return comments.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

/** A search party's time and place, who is going, and "I am going". */
export function PartyBlock({ post, forceId, canPost, onChanged }) {
  const [going, setGoing] = useState(post.iAmGoing);
  const [count, setCount] = useState(post.goingCount || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const at = new Date(post.eventAt);
  const over = at.getTime() < Date.now() - 3 * 3600e3;

  async function set(next) {
    setBusy(true);
    setError('');
    try {
      const data = await send(`/api/rescue-forces/${forceId}/posts/${post.id}/going`, { going: next });
      setGoing(data.going);
      setCount(data.goingCount);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const names = post.goingNames || [];
  const who = count === 0 ? 'Nobody has said yet' : `${count} going${names.length ? `: ${names.slice(0, 3).join(', ')}${count > 3 ? ' and more' : ''}` : ''}`;

  return (
    <div className="mt-3 flex gap-3 rounded-2xl bg-midnight-50 p-3 ring-1 ring-midnight-200">
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white ring-1 ring-midnight-200" aria-hidden="true">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-red-700">
          {at.toLocaleDateString('en-US', { weekday: 'short' })}
        </span>
        <span className="text-xl font-extrabold leading-none text-midnight-900">{at.getDate()}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-wide text-midnight-500">Search party</p>
        <p className="font-bold text-midnight-900">{partyWhen(post.eventAt)}</p>
        {post.eventPlace && <p className="text-[15px] text-midnight-700">{post.eventPlace}</p>}
        <p className="mt-1 text-sm text-midnight-600">{who}</p>
        {canPost && !over && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {going ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-midnight-900">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  You are going
                </span>
                <button
                  type="button"
                  onClick={() => set(false)}
                  disabled={busy}
                  className="text-sm font-semibold text-midnight-600 underline underline-offset-4 hover:text-midnight-900 disabled:opacity-60"
                >
                  I can&apos;t go after all
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => set(true)}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-flash-400 px-4 text-sm font-bold text-midnight-900 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                I am going
              </button>
            )}
          </div>
        )}
        {over && <p className="mt-1 text-sm font-semibold text-midnight-500">This search party is over.</p>}
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DiscussionPost({ post, forceId, canPost, onChanged, onFilterPet }) {
  const helpful = useHelpful(post.userVote === 1, post.upvotes || 0, `/api/rescue-forces/${forceId}/posts/${post.id}/vote`);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputId = `comment-${post.id}`;
  const role = roleLabel(post.authorRole);
  const comments = post.comments ? countComments(post.comments) : post.commentCount || 0;

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
    <article className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
      <header className="flex items-center gap-3">
        <Initial name={post.authorName} />
        <div className="min-w-0">
          <p className="truncate font-bold text-midnight-900">
            {post.authorName}
            {role && <span className="ml-1.5 text-sm font-semibold text-midnight-500">{role}</span>}
          </p>
          <p className="text-sm text-midnight-500">
            {timeAgo(post.createdAt)}
            {post.divisionName ? ` · ${post.divisionName}` : ''}
          </p>
        </div>
      </header>

      {(post.topic || post.pet) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {post.topic && TOPIC_LABEL[post.topic] && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TOPIC_STYLE[post.topic] || 'bg-midnight-100 text-midnight-700'}`}>
              {TOPIC_LABEL[post.topic]}
            </span>
          )}
          {post.pet && (
            <button
              type="button"
              onClick={() => onFilterPet?.(post.pet)}
              className="inline-flex min-h-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-midnight-800 ring-1 ring-midnight-200 hover:ring-midnight-400"
            >
              <PetStatusDot status={post.pet.status} />
              {post.pet.name}
            </button>
          )}
        </div>
      )}

      {post.topic === 'SEARCH_PARTY' && post.eventAt && (
        <PartyBlock post={post} forceId={forceId} canPost={canPost} onChanged={onChanged} />
      )}

      {post.title && <h3 className="mt-3 text-base font-bold text-midnight-900">{post.title}</h3>}
      <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-midnight-800">
        <PostText text={post.content} />
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-[28rem] w-full rounded-xl object-cover" />
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-midnight-100 pt-2">
        <HelpfulButton helpful={helpful} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-midnight-500 hover:text-midnight-800"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {comments > 0 ? `${comments} ${comments === 1 ? 'comment' : 'comments'}` : 'Comment'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {post.comments?.length > 0 && (
            <ul className="space-y-2.5">
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
                  <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-midnight-700 underline">
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
              {error && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </article>
  );
}
