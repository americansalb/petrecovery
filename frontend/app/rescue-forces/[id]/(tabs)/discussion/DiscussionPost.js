'use client';

/**
 * One post in a force's Discussion.
 *
 * The force's automatic posts about its pets (app/lib/forceFeed.js: a pet
 * reported lost or found in its area, a sighting, a pet back home) are pet
 * cards: the photo, what happened, and the things to do (the search map,
 * "I've seen Max", the report). They are posted as the force; a sighting
 * is posted as the person who saw the pet. The card's words come from the
 * pet as it is now, not from the post's stored text, so an older automatic
 * post reads the same as a new one, and one about a pet that is home says
 * so.
 *
 * A member's own post is their words and photo, with the pet it is about,
 * or a search party's time and place with who is going
 * (app/components/help/SearchPartyCard.js, shared with the pet's page).
 *
 * Under every post: Helpful, the latest comments, and the box to write
 * one. APIs: POST .../posts/[postId]/vote (1 marks it helpful, 0 takes that
 * back), .../posts/[postId]/comments ({ content, parentCommentId }),
 * .../comments/[commentId]/vote.
 */

import { Fragment, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, Map as MapIcon, MessageCircle, Shield, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui';
import { timeAgo } from '@/app/lib/caseLabels';
import { FORCE_ROLE_LABEL } from '@/app/lib/forceRoles';
import PetStatusDot from '@/app/components/PetStatusDot';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import SearchPartyCard from '@/app/components/help/SearchPartyCard';

const COMMENTS_SHOWN = 2;

export async function send(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not go through. Try again.');
  return data;
}

// A case number ("AUS-2026-7KQ4MX", older "AUS-2026-0001") in a post links
// to that pet's page: older automatic posts ended with one.
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 font-semibold transition ${small ? 'min-h-0 text-xs' : 'text-sm'} ${
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
              <button type="button" onClick={() => onReply(c)} className="min-h-0 rounded-full px-2 text-xs font-semibold text-midnight-500 hover:text-midnight-800">
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

function PetPhoto({ pet }) {
  const [failed, setFailed] = useState(false);
  const box = 'h-[88px] w-[88px] shrink-0 rounded-2xl';
  if (!pet?.photo || failed) {
    return (
      <span className={`${box} flex items-center justify-center bg-midnight-100 text-midnight-400`} aria-hidden="true">
        <SpeciesIcon species={String(pet?.species || '').toUpperCase()} size={34} />
      </span>
    );
  }
  return (
    // Report photos come from the CDN and uploads; next/image is not set up for them.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pet.photo} alt="" loading="lazy" onError={() => setFailed(true)} className={`${box} bg-midnight-100 object-cover`} />
  );
}

// a.bg-midnight-900 gets its shading from app/globals.css.
const DARK = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-midnight-900 px-4 text-sm font-bold text-white';
const LIGHT = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-midnight-200 bg-white px-4 text-sm font-bold text-midnight-800 transition hover:border-midnight-300';

/** The force's automatic post about a pet: the photo, what happened, the things to do. */
function PetCard({ kind, post }) {
  const pet = post.pet;
  const ref = encodeURIComponent(pet.caseNumber);
  const map = `/mission-control?mission=${ref}`;
  const page = `/cases/${ref}`;
  const when = pet.since ? timeAgo(pet.since) : '';
  const stillLost = pet.status === 'lost';
  const pageLink = [page, `${pet.name}'s page`, LIGHT];
  let line;
  let actions;
  if (kind === 'LOST') {
    line = stillLost
      ? `${pet.line}. Last seen${pet.near ? ` near ${pet.near}` : ''}${when ? `, ${when}` : ''}.`
      : pet.status === 'home'
        ? `${pet.line}. Back home now.`
        : `${pet.line}.`;
    actions = stillLost ? [[map, 'Help search', DARK, MapIcon], [`${map}&action=sighting`, `I've seen ${pet.name}`, LIGHT, Eye]] : [pageLink];
  } else if (kind === 'FOUND') {
    line = `${pet.line}. Found${pet.near ? ` near ${pet.near}` : ''}${when ? `, ${when}` : ''}.${
      pet.status === 'found' ? ' Is it one of the pets we are looking for?' : ''
    }`;
    actions = [[page, 'See the report', DARK]];
  } else if (kind === 'SIGHTING') {
    line = post.content || '';
    actions = stillLost ? [[map, 'See on the map', DARK, MapIcon]] : [pageLink];
  } else {
    line = `Back with the family${pet.home ? `, ${timeAgo(pet.home)}` : ''}.`;
    actions = [pageLink];
  }
  return (
    <div className="mt-3 rounded-2xl bg-midnight-50 p-3 ring-1 ring-midnight-100">
      <div className="flex gap-3">
        <PetPhoto pet={pet} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-extrabold leading-tight text-midnight-900">{post.title}</h3>
          {line && <p className="mt-1 text-[15px] leading-snug text-midnight-700">{line}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map(([href, label, cls, Icon]) => (
          <Link key={label} href={href} className={cls}>
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DiscussionPost({ post, forceId, forceName, canPost, onChanged }) {
  const helpful = useHelpful(post.userVote === 1, post.upvotes || 0, `/api/rescue-forces/${forceId}/posts/${post.id}/vote`);
  const [showAll, setShowAll] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputId = `comment-${post.id}`;
  const role = roleLabel(post.authorRole);
  // A pet card needs its pet; without one the post reads as words.
  const kind = post.kind && post.pet ? post.kind : null;
  const asForce = kind && kind !== 'SIGHTING';
  const comments = post.comments || [];
  const total = comments.length ? countComments(comments) : post.commentCount || 0;
  const shown = showAll ? comments : comments.slice(-COMMENTS_SHOWN);
  const hidden = comments.length - shown.length;

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
      setShowAll(true);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
      <header className="flex items-center gap-3">
        {asForce ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-midnight-900 text-flash-400" aria-hidden="true">
            <Shield size={20} />
          </span>
        ) : (
          <Initial name={post.authorName} />
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-midnight-900">
            {asForce ? forceName : post.authorName}
            {!asForce && role && <span className="ml-1.5 text-sm font-semibold text-midnight-500">{role}</span>}
          </p>
          <p className="text-sm text-midnight-500">
            {timeAgo(post.createdAt)}
            {!asForce && post.divisionName ? ` · ${post.divisionName}` : ''}
          </p>
        </div>
      </header>

      {kind ? (
        <PetCard kind={kind} post={post} />
      ) : (
        <>
          {post.pet && (
            <Link
              href={`/cases/${encodeURIComponent(post.pet.caseNumber)}`}
              className="mt-3 inline-flex min-h-0 items-center gap-1.5 rounded-full bg-midnight-50 px-2.5 py-1 text-xs font-bold text-midnight-800 ring-1 ring-midnight-200 hover:ring-midnight-400"
            >
              <PetStatusDot status={post.pet.status} />
              {post.pet.name}
              {post.pet.status === 'found' && post.pet.near ? ` near ${post.pet.near}` : ''}
            </Link>
          )}
          {post.topic === 'SEARCH_PARTY' && post.eventAt && (
            <SearchPartyCard
              className="mt-3"
              party={{ id: post.id, at: post.eventAt, place: post.eventPlace, goingCount: post.goingCount, goingNames: post.goingNames, iAmGoing: post.iAmGoing }}
              heading={post.pet ? `Search for ${post.pet.name}` : 'Search party'}
              forceId={forceId}
              canGo={canPost}
              onChanged={onChanged}
            />
          )}
          {post.title && <h3 className="mt-3 text-base font-bold text-midnight-900">{post.title}</h3>}
          {post.content && (
            <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-midnight-800">
              <PostText text={post.content} />
            </p>
          )}
          {post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-[28rem] w-full rounded-xl object-cover" />
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-midnight-100 pt-2">
        <HelpfulButton helpful={helpful} />
        <span className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-midnight-500">
          <MessageCircle size={16} aria-hidden="true" />
          {total > 0 ? `${total} ${total === 1 ? 'comment' : 'comments'}` : 'No comments yet'}
        </span>
      </div>

      {(comments.length > 0 || canPost) && (
        <div className="mt-3 space-y-3">
          {hidden > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="min-h-0 text-sm font-bold text-midnight-700 underline-offset-4 hover:underline">
              Show {hidden} earlier {hidden === 1 ? 'comment' : 'comments'}
            </button>
          )}
          {shown.length > 0 && (
            <ul className="space-y-2.5">
              {shown.map((c) => (
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
                  <button type="button" onClick={() => setReplyTo(null)} className="min-h-0 font-semibold text-midnight-700 underline">
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
                  className="min-w-0 flex-1 rounded-full border border-midnight-200 bg-midnight-50 px-4 py-2 text-midnight-900 placeholder:text-midnight-400 outline-none focus:border-midnight-400 focus:bg-white focus:ring-2 focus:ring-flash-400"
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
