'use client';

/**
 * The profile page: who you are in the game and what your points buy.
 * Everything comes from /api/geo/profile (the summary: ratings, points,
 * badges, recent points, today's meter) and /api/geo/shop (the catalog
 * with what you own, may wear and can afford). Buying and wearing go
 * through the shop route; the name through the profile route.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Gauge,
  History,
  Medal,
  Play,
  ShoppingBag,
  Tag,
  Trophy,
  Users,
} from 'lucide-react';
import { formatScore, ordinal } from '@/app/lib/geo/distance';
import { ITEM_KINDS } from '@/app/lib/geo/items';
import {
  countryBadgeProgress,
  playableCountryCodes,
} from '@/app/lib/geo/badges';
import { VARIANTS, DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';
import {
  LADDERS,
  LADDER_LABELS,
  PROVISIONAL_GAMES,
} from '@/app/lib/geo/rating';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { saveName } from '../lib/useRoom';
import { ago } from '../lib/time';
import Card, { CardTitle } from './ui/Card';
import Tabs from './ui/Tabs';
import SignInCard from './SignInCard';
import AccountRole from './AccountRole';

const KIND_ORDER = ['pin', 'color', 'title', 'frame', 'reactions'];
const TABS = [
  { id: 'record', label: 'Record' },
  { id: 'shop', label: 'Shop' },
  { id: 'settings', label: 'Settings' },
];
// What a badge can be earned in: the countries the game actually drops
// you in. The badge model covers every country, which made "12 badges"
// read against a denominator nobody can reach.
const PLAYABLE_COUNTRIES = playableCountryCodes('apple');

/** One ladder: the rating, the tier, and what was won on it. */
function LadderCard({ ladder, rating, provisionalGames }) {
  const label = ladder === 'duel' ? 'Street multiplayer' : LADDER_LABELS[ladder] || VARIANTS[ladder]?.label || ladder;
  const games = rating?.games || 0;
  if (games < provisionalGames) {
    return (
      <Card tone="sunken" pad="sm" className="rounded-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-white/70">Unplaced</p>
        <p className="mt-1 text-xs text-white/60">
          {games} of {provisionalGames} placement games
        </p>
        <div className="pe-placement-track" aria-hidden="true">
          {Array.from({ length: provisionalGames }, (_, i) => (
            <span key={i} data-complete={i < games} />
          ))}
        </div>
        <Link
          className="pe-placement-play"
          href={
            ladder === 'solo'
              ? '/geo/play?mode=ranked'
              : `/geo/rooms?game=${ladder === 'script' ? 'script' : 'street'}`
          }
        >
          Play to place <span aria-hidden="true">↗</span>
        </Link>
      </Card>
    );
  }
  return (
    <Card tone="sunken" pad="sm" className="rounded-xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-clay-300">
        {rating.value}
      </p>
      <p className="text-xs text-white/70">{rating.tier}</p>
      <p className="mt-1 text-xs text-white/70">{rating.rank ? `#${rating.rank} of ${rating.population}` : ''}{rating.accuracy != null ? ` · ${Math.floor(rating.accuracy * 1000) / 10}% accuracy` : ''}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-white/60">Played</dt>
          <dd className="font-semibold tabular-nums">{games}</dd>
        </div>
        <div>
          <dt className="text-white/60">Won</dt>
          <dd className="font-semibold tabular-nums">{rating.wins}</dd>
        </div>
        <div>
          <dt className="text-white/60">Best</dt>
          <dd className="font-semibold tabular-nums">{rating.peak}</dd>
        </div>
      </dl>
      {rating.streak > 1 ? (
        <p className="mt-2 text-xs font-semibold text-forest-300">
          {rating.streak} in a row
        </p>
      ) : null}
    </Card>
  );
}

function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** A pin as the map draws it, for the shop. */
function PinPreview({ style = 'dot', fill = '#facc15' }) {
  const stroke = '#0f172a';
  return (
    <svg viewBox="-14 -14 28 28" className="h-8 w-8" aria-hidden="true">
      {style === 'ring' ? (
        <circle
          r="9"
          fill={fill}
          fillOpacity="0.25"
          stroke={fill}
          strokeWidth="3"
        />
      ) : null}
      {style === 'star' ? (
        <path
          d="M 0 -11 L 3.2 -3.6 L 11 -3.4 L 4.9 1.6 L 6.8 9.2 L 0 4.8 L -6.8 9.2 L -4.9 1.6 L -11 -3.4 L -3.2 -3.6 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
      ) : null}
      {style === 'diamond' ? (
        <path
          d="M 0 -11 L 10 0 L 0 11 L -10 0 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
      ) : null}
      {style === 'dot' ? (
        <circle r="9" fill={fill} stroke={stroke} strokeWidth="2" />
      ) : null}
    </svg>
  );
}

function ItemCard({ item, points, busy, onBuy, onEquip, equippedId, index = 0 }) {
  const wearing = equippedId === item.id;
  const tierOnly = Boolean(item.requires?.tier);
  let action = null;
  if (item.kind === 'reactions') {
    action = item.owned ? (
      <span className="text-xs font-semibold text-forest-300">Yours</span>
    ) : null;
  } else if (wearing) {
    action = (
      <span className="text-xs font-semibold text-forest-300">Wearing</span>
    );
  } else if (item.usable) {
    action = (
      <button
        type="button"
        disabled={busy}
        onClick={() => onEquip(item.id)}
        aria-label={`Wear ${item.name}`}
        className="min-h-[44px] rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
      >
        Wear
      </button>
    );
  }
  let buy = null;
  if (!item.owned && !item.free && !tierOnly) {
    buy = item.affordable ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => onBuy(item.id)}
        aria-label={`Buy ${item.name} for ${formatScore(item.price)} points`}
        className="min-h-[44px] rounded-lg bg-ocean-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ocean-800 disabled:opacity-50"
      >
        Buy for {formatScore(item.price)}
      </button>
    ) : (
      // The balance is at the top of the page. Repeating it on every
      // row of a long list is noise, and it made each row read as a
      // refusal rather than a price.
      <span className="text-xs text-white/60">
        {formatScore(item.price)} points
      </span>
    );
  }
  if (tierOnly && !item.usable)
    buy = (
      <span className="text-xs text-white/60">
        Free at {item.requires.tier} on any ladder
      </span>
    );
  return (
    <li
      style={{ '--i': index }}
      className={`flex items-center gap-3 rounded-xl border p-3 ${wearing ? 'border-clay-400 bg-ocean-950' : 'border-white/10 bg-ocean-900/60'}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
        {item.kind === 'pin' ? (
          <PinPreview style={item.style} fill={item.fill} />
        ) : null}
        {item.kind === 'color' ? (
          <span
            className="h-5 w-5 rounded-full border border-white/15"
            style={{ backgroundColor: item.value || '#ffffff' }}
          />
        ) : null}
        {item.kind === 'title' ? (
          <Tag className="h-4 w-4 text-white/60" />
        ) : null}
        {item.kind === 'frame' ? (
          <span
            className="h-6 w-6 rounded-full bg-sand-300"
            style={
              item.value ? { boxShadow: `0 0 0 3px ${item.value}` } : undefined
            }
          />
        ) : null}
        {item.kind === 'reactions' ? (
          <span className="text-sm">
            {(item.emoji || []).slice(0, 2).join('')}
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.name}</p>
        <p className="truncate text-xs text-white/60">{item.description}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {action}
        {buy}
      </div>
    </li>
  );
}

export default function ProfileClient() {
  const [profile, setProfile] = useState(null);
  const [shop, setShop] = useState(null);
  const [tab, setTab] = useState('record');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('pin');

  useEffect(() => {
    let alive = true;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      setProfile(null); setShop(null); setName(''); setError('');
      try {
        // The verified account owns its name. A stale nickname on another
        // device must never rename it just by opening the profile page.
        const profile = await ensureProfile('');
        if (!alive || current !== generation) return;
        setProfile(profile); setName(profile?.name || '');
        // Not the placeholder. resolveProfile stores DEFAULT_PLAYER_NAME
        // for anybody who has not chosen one, so saving it here wrote
        // "Player" into this browser the first time somebody so much as
        // opened their profile - and every room they hosted afterwards
        // was called Player, with the field pre-filled as though they
        // had typed it. Founder, 2026-09-17: "why does it pretend I
        // have an account named player". A name goes in the browser
        // when a person chooses one, which is what saveTheName below
        // is for.
        if (profile?.name && profile.name !== DEFAULT_PLAYER_NAME) saveName(profile.name);
        const res = await fetch('/api/geo/shop', { headers: profileHeaders(), cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not load the shop');
        if (alive && current === generation) setShop(json.shop);
      } catch (error) {
        if (alive && current === generation) setError(error.message || 'Could not load your profile');
      }
    };
    refresh();
    window.addEventListener('geo:session-changed', refresh);
    return () => {
      alive = false;
      window.removeEventListener('geo:session-changed', refresh);
    };
  }, []);

  const saveTheName = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 20);
    if (!clean) return;
    setBusy(true);
    try {
      const p = await ensureProfile(clean);
      saveName(clean);
      setProfile(p);
      setSavedName(clean);
      setTimeout(() => setSavedName(''), 2000);
    } catch (err) {
      setError(err.message || 'Could not save the name');
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, itemId) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/geo/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...profileHeaders() },
        body: JSON.stringify({ action, itemId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'That did not work');
      setShop(json.shop);
      setProfile((prev) =>
        prev
          ? { ...prev, points: json.shop.points, equipped: json.shop.view }
          : prev,
      );
    } catch (err) {
      setError(err.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo(
    () => (shop?.items || []).filter((i) => i.kind === kind),
    [shop, kind],
  );
  const badgeProgress = countryBadgeProgress(
    profile?.badges,
    PLAYABLE_COUNTRIES,
  );
  const view = shop?.view || profile?.equipped || null;
  const points = shop?.points ?? profile?.points ?? 0;

  /**
   * Has this player done anything yet?
   *
   * Record was five headings over five zeros for everybody who had not
   * played: three identical "Unplaced - 0 of 5 placement games" cards
   * (one per ladder, because there are three ladders), "No rated games
   * yet", "None yet", and "0 Street rounds today". Six ways of saying
   * nothing has happened, which is the feature list rendered as a page
   * rather than a record of anything (founder, 2026-09-22: "like the
   * person that made it does not know the purpose of the app but only
   * each individual feature").
   *
   * A record with nothing in it gets one card and a way to start one.
   * The moment any of it is true, the real sections come back, each
   * carrying what it now has.
   */
  const hasRecord = Boolean(
    profile &&
      (profile.recent?.length ||
        profile.badges?.length ||
        profile.usage?.rounds ||
        // Points outlive the day. usage.rounds is today's meter and
        // resets overnight, so somebody who played yesterday, never got
        // within 100 km of anything and has not touched a rated game
        // would otherwise be told tomorrow that their record had not
        // started. Every finished round pays at least roundBase, so a
        // balance above zero is somebody who has played.
        profile.points ||
        LADDERS.some((ladder) => profile.ratings?.[ladder]?.games)),
  );

  return (
    <div className="pe-secondary-page pe-profile-page min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="pe-profile-banner flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-clay-400 text-xl font-bold text-ocean-950"
            style={
              view?.frame ? { boxShadow: `0 0 0 4px ${view.frame}` } : undefined
            }
            aria-hidden="true"
          >
            {initialsOf(profile?.name || name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Your profile
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
              <span style={view?.color ? { color: view.color } : undefined}>
                {profile?.name || name || 'Player'}
              </span>
              {view?.title ? (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white/60">
                  {view.title}
                </span>
              ) : null}
              {/* A profile called "Player" with nothing saying where it
                  came from reads as an account somebody made for you
                  (founder, 2026-09-17: "why does it pretend I have an
                  account named player"). */}
              {profile && !profile.signedIn ? (
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs font-semibold text-white/70">
                  Guest, this browser
                </span>
              ) : null}
            </h1>
            {profile?.season ? (
              <p className="mt-1 text-sm text-white/60" data-season>
                {profile.season.label} &middot; {profile.season.daysLeft}{' '}
                {profile.season.daysLeft === 1 ? 'day' : 'days'} left
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">
              {formatScore(points)}
            </p>
            {/* Not just "points": a round score is points too, and a
                rating is a third number. Each one says which it is. */}
            <p className="text-sm text-white/60">cosmetic points</p>
          </div>
        </header>

        {profile && !profile.signedIn ? (
          <div className="mt-5 flex items-center justify-between gap-4 border-b border-white/15 pb-5">
            <p className="text-sm text-white/75">Keep your games on every device.</p>
            <Link href="/geo/signin" className="pe-button pe-button--primary min-h-[44px] px-4 py-3">Save your player</Link>
          </div>
        ) : null}

        {/* A signed-in account still carrying the placeholder renders
            as "Player", which is the same screen the founder rejected
            on a guest: an account that pretends to be named for you
            (2026-09-17: "why does it pretend I have an account named
            player"). The name is not empty in that case - resolveProfile
            stores the placeholder - so this compares against it rather
            than checking for a blank. Every signup path asks for a name
            now, so an account in this state was made before they did.
            Say what is happening and point at the one field that fixes
            it, rather than leaving the name buried in a tab nobody
            opens. */}
        {profile?.signedIn && (!profile.name || profile.name === DEFAULT_PLAYER_NAME) ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
            <p className="text-sm text-white/75">Your account has no name yet, so scoreboards show you as Player.</p>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className="pe-button pe-button--primary min-h-[44px] px-4 py-3"
            >
              Choose your name
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {/* One page had seven sections doing three unrelated jobs, and
            the biggest of them was the shop, so the first thing a
            player saw about themselves was a price list. Each tab is
            one job (founder, 2026-09-17: the page has to know what it
            is for). */}
        <Tabs
          items={TABS}
          value={tab}
          onChange={setTab}
          label="Profile sections"
          panelId="profile-panel"
          marker="profile-tab"
          className="mt-6"
        />

        {tab === 'record' && profile && !hasRecord ? (
          <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-panel-tab-${tab}`} tabIndex={0} className="pe-swap mt-6">
            <Card data-no-record>
              <CardTitle icon={Medal}>Your record</CardTitle>
              <p className="mt-3 text-sm text-white/75">
                It starts with one game. Every round you play is kept
                here: your rating on each ladder, the games you have
                played against other people, and a badge for every
                country you guess within 100 km.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/geo"
                  className="pe-button pe-button--primary inline-flex min-h-[48px] items-center gap-2 px-5 py-3 font-bold"
                >
                  <Play size={17} fill="currentColor" aria-hidden="true" />
                  Play a game
                </Link>
                <Link
                  href="/geo/rooms"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/5"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Play with a friend
                </Link>
              </div>
            </Card>
          </div>
        ) : null}

        {tab === 'record' && (!profile || hasRecord) ? (
          <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-panel-tab-${tab}`} tabIndex={0} className="pe-swap mt-6 space-y-6">
            {/* Rating: every ladder, with what a player earned on it
                rather than the word for where it sits. */}
            <Card data-ratings>
              <CardTitle icon={Medal}>Rating</CardTitle>
              {profile ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {LADDERS.filter((ladder) => ladder !== 'classic').map((ladder) => (
                    <LadderCard
                      key={ladder}
                      ladder={ladder}
                      rating={profile.ratings?.[ladder]}
                      provisionalGames={
                        profile.provisionalGames ?? PROVISIONAL_GAMES
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">Loading</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/geo/leaderboard"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Rankings
                </Link>
                <Link
                  href="/geo/rooms"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
                >
                  <Users className="h-3.5 w-3.5" />
                  Multiplayer
                </Link>
              </div>
            </Card>

            {/* Recent rated games. The server has sent these with every
                profile since ratings shipped and nothing read them. */}
            <Card data-recent>
              <CardTitle icon={History}>Rated matches</CardTitle>
              {profile?.recent?.length ? (
                <ul className="mt-3 divide-y divide-white/10 text-sm">
                  {profile.recent.map((row, i) => (
                    <li
                      key={`${row.roomId}:${i}`}
                      className="flex items-center gap-3 py-2"
                    >
                      <span
                        className={`w-14 shrink-0 font-bold tabular-nums ${row.placement === 1 ? 'text-clay-300' : 'text-white'}`}
                      >
                        {ordinal(row.placement)}
                      </span>
                      <span className="w-20 shrink-0 text-white/60">
                        of {row.players}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-white/60">
                        {LADDER_LABELS[row.ladder] ||
                          VARIANTS[row.ladder]?.label ||
                          row.ladder}{' '}
                        &middot; {ago(row.at)}
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${row.delta > 0 ? 'text-forest-300' : row.delta < 0 ? 'text-red-300' : 'text-white/60'}`}
                      >
                        {row.delta > 0 ? '+' : ''}
                        {row.delta}
                      </span>
                      <span className="w-14 shrink-0 text-right tabular-nums text-white/60">
                        {row.after}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">
                  No rated games yet.{' '}
                  <Link
                    href="/geo/rooms"
                    className="underline hover:text-white"
                  >
                    Open a room
                  </Link>{' '}
                  or{' '}
                  <Link
                    href="/geo/play?mode=ranked"
                    className="underline hover:text-white"
                  >
                    play the ranked hour
                  </Link>
                  .
                </p>
              )}
            </Card>

            {/* Badges */}
            <Card data-badges>
              <CardTitle
                icon={Award}
                trailing={
                  badgeProgress.show
                    ? `${badgeProgress.earned} of ${badgeProgress.total} countries`
                    : null
                }
              >
                Badges
              </CardTitle>
              {/* Badges outlive the coverage that awarded them. The
                  city list holds 56 countries and 23 of them are
                  playable today, so a player from the Google era holds
                  rows for places no round can reach: counted in, they
                  print "40 of 23"; dropped, they vanish without a
                  word. */}
              {badgeProgress.elsewhere ? (
                <p className="mt-1 text-xs text-white/60">
                  {badgeProgress.elsewhere} more from places the game no longer
                  visits.
                </p>
              ) : null}
              {profile?.badges?.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.badges.map((b) => (
                    <li
                      key={b.countryCode}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${b.notEarth ? 'border-clay-400/40 bg-clay-500/10' : 'border-white/10'}`}
                    >
                      <span className="text-xl">{b.flag}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {b.name}
                      </span>
                      <span className="text-xs text-white/60">
                        {b.notEarth
                          ? 'called it'
                          : b.bestKm < 1
                            ? 'under 1 km'
                            : `${Math.round(b.bestKm)} km`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">
                  None yet. A guess within 100 km earns that country&apos;s
                  badge.
                </p>
              )}
            </Card>

            {/* Today */}
            <Card>
              <CardTitle icon={Gauge}>Today</CardTitle>
              {profile?.usage ? (
                <p className="mt-2 text-sm text-white/70">
                  <span className="font-semibold text-white">
                    {profile.usage.rounds}
                  </span>{' '}
                  Street rounds today.
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/60">Loading</p>
              )}
            </Card>
          </div>
        ) : null}

        {tab === 'shop' ? (
          <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-panel-tab-${tab}`} tabIndex={0} className="pe-swap mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card data-shop>
              <CardTitle icon={ShoppingBag}>Shop</CardTitle>
              <p className="mt-2 text-sm text-white/60">
                Points buy how you look. Nothing here changes how you play.
              </p>
              <Tabs
                items={KIND_ORDER.map((k) => ({ id: k, label: ITEM_KINDS[k] }))}
                value={kind}
                onChange={setKind}
                label="Shop sections"
                panelId="shop-panel"
                marker="shop-kind"
                className="mt-3"
              />
              <div id="shop-panel" role="tabpanel" aria-labelledby={`shop-panel-tab-${kind}`} tabIndex={0}>
              {shop ? (
                // Keyed on the kind, so choosing Pins after Colours is a
                // new list that arrives row by row rather than the old
                // rows' text changing under the player's eye.
                <ul key={kind} className="pe-stagger mt-3 space-y-2">
                  {items.map((item, index) => (
                    <ItemCard
                      index={index}
                      key={item.id}
                      item={item}
                      points={points}
                      busy={busy}
                      onBuy={(id) => act('buy', id)}
                      onEquip={(id) => act('equip', id)}
                      equippedId={shop.equipped?.[item.kind]}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">
                  {error ? 'The shop is closed for now.' : 'Loading the shop'}
                </p>
              )}
              </div>
            </Card>

            {/* Where the points came from, beside what they buy. */}
            <aside>
              <Card data-ledger>
                <CardTitle>Recent points</CardTitle>
                {profile?.ledger?.length ? (
                  <ul className="mt-3 divide-y divide-white/10 text-sm">
                    {profile.ledger.map((row, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-white/70">
                          {row.reason}{' '}
                          <span className="text-white/50">{ago(row.at)}</span>
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${row.kind === 'earn' ? 'text-forest-300' : 'text-white'}`}
                        >
                          {row.kind === 'earn' ? '+' : '-'}
                          {row.amount}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-white/60">
                    Nothing yet. Every scored round earns some.
                  </p>
                )}
              </Card>
            </aside>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-panel-tab-${tab}`} tabIndex={0} className="pe-swap mt-6 grid gap-6 sm:grid-cols-2">
            {/* Signing in. A Probably Earth account, not a ReunitePets one. */}
            <Card>
              <CardTitle>Account</CardTitle>
              <p className="mt-2 text-sm text-white/60">
                {profile?.signedIn
                  ? 'Signed in, so this profile follows you to other devices.'
                  : 'This profile lives in this browser.'}
              </p>
              <div className="mt-3">
                <SignInCard requireName playerName={name} onPlayerNameChange={setName} />
              </div>
            </Card>

            <div className="space-y-6">
              {/* What this account is: tier, and role when it is not the
                  ordinary one. Renders for signed-in players only. */}
              <AccountRole />

              <Card>
                <CardTitle>Your name</CardTitle>
                <form
                  method="post"
                  onSubmit={saveTheName}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    aria-label="Your name"
                    className="w-full rounded-xl border border-white/15 bg-ocean-900/60 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="rounded-xl bg-ocean-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ocean-800 disabled:opacity-50"
                  >
                    {savedName ? 'Saved' : 'Save'}
                  </button>
                </form>
                <p className="mt-2 text-xs text-white/60">
                  What rooms and the boards show.
                </p>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
