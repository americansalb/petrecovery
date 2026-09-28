'use client';

/**
 * A force's Discussion: one feed, like a group. What leaders pinned, the
 * search parties coming up, then every post newest first: members' own
 * posts, and the force's automatic ones about its pets (a pet reported
 * lost or found in its area, a sighting, a pet back home), drawn as pet
 * cards with the photo and the things to do (app/lib/forceFeed.js,
 * ./DiscussionPost.js).
 *
 * Posting is the box at the top (./Composer.js): write, add a photo,
 * post; leaders can pin it. Planning a search party is its own sheet
 * (./PlanSearchSheet.js).
 *
 * APIs: GET .../posts (sort=new, before, upcoming=1), GET .../announcements.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, Pin } from 'lucide-react';
import { Button } from '@/components/ui';
import { timeAgo } from '@/app/lib/caseLabels';
import DiscussionPost, { PostText } from './DiscussionPost';
import Composer from './Composer';
import PlanSearchSheet from './PlanSearchSheet';

function Announcement({ a }) {
  return (
    <article className="rounded-2xl bg-flash-50 p-4 ring-1 ring-flash-300">
      <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-flash-900">
        {a.isPinned ? <Pin size={13} aria-hidden="true" /> : <Megaphone size={13} aria-hidden="true" />}
        {a.isPinned ? `Pinned by ${a.authorName}` : `Announcement from ${a.authorName}`}
      </p>
      <h3 className="mt-1 text-lg font-bold text-midnight-900">{a.title}</h3>
      {a.content !== a.title && (
        <p className="mt-1 whitespace-pre-line break-words text-[15px] text-midnight-800">
          <PostText text={a.content} />
        </p>
      )}
      <p className="mt-2 text-sm text-midnight-500">{timeAgo(a.createdAt)}</p>
    </article>
  );
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function DiscussionClient({ forceId, forceName, canPost, canAnnounce, myName, pets }) {
  const [announcements, setAnnouncements] = useState([]);
  const [parties, setParties] = useState([]);
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | ready | failed
  const [older, setOlder] = useState(false);
  const [planning, setPlanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, p, up] = await Promise.all([
        getJson(`/api/rescue-forces/${forceId}/announcements`),
        getJson(`/api/rescue-forces/${forceId}/posts?sort=new`),
        getJson(`/api/rescue-forces/${forceId}/posts?upcoming=1`),
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
  }, [forceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadOlder() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setOlder(true);
    try {
      const p = await getJson(`/api/rescue-forces/${forceId}/posts?sort=new&before=${encodeURIComponent(new Date(last.createdAt).toISOString())}`);
      setPosts((prev) => [...prev, ...(p.posts || [])]);
      setHasMore(Boolean(p.hasMore));
    } catch {
      // The button stays; tapping it again tries again.
    }
    setOlder(false);
  }

  // A party still to come sits under "Coming up", not in the stream as well.
  const partyIds = new Set(parties.map((p) => p.id));
  const stream = posts.filter((p) => !partyIds.has(p.id));
  const postProps = { forceId, forceName, canPost, onChanged: load };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4 lg:pb-12 lg:pt-6">
      <div className="space-y-4">
        {canPost && <Composer forceId={forceId} myName={myName} pets={pets} canPin={canAnnounce} onPosted={load} onPlan={() => setPlanning(true)} />}

        {status === 'loading' ? (
          <p className="flex items-center gap-2 py-6 text-midnight-500" aria-busy="true">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Loading the discussion
          </p>
        ) : status === 'failed' ? (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
            <p className="text-midnight-700">The discussion did not load.</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus('loading');
                load();
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {announcements.length > 0 && (
              <section aria-label="Pinned" className="space-y-3">
                {announcements.map((a) => (
                  <Announcement key={a.id} a={a} />
                ))}
              </section>
            )}

            {parties.length > 0 && (
              <section aria-labelledby="coming-up" className="space-y-3">
                <h2 id="coming-up" className="text-xs font-extrabold uppercase tracking-wider text-midnight-500">
                  Coming up
                </h2>
                {parties.map((post) => (
                  <DiscussionPost key={post.id} post={post} {...postProps} />
                ))}
              </section>
            )}

            {stream.length === 0 ? (
              <div className="rounded-2xl bg-white px-5 py-8 text-center ring-1 ring-midnight-200">
                <p className="font-semibold text-midnight-900">No posts yet</p>
                <p className="mt-1 text-sm text-midnight-600">{canPost ? 'Say hello, or post what you know.' : 'Members will post here.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stream.map((post) => (
                  <DiscussionPost key={post.id} post={post} {...postProps} />
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

      <PlanSearchSheet
        open={planning}
        onClose={() => setPlanning(false)}
        forceId={forceId}
        pets={pets}
        onPosted={() => {
          setPlanning(false);
          load();
        }}
      />
    </div>
  );
}
