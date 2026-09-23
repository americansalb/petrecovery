'use client';

/**
 * The profile page: who you are in the game and what your points buy.
 * Everything comes from /api/geo/profile (the summary: ratings, points,
 * badges, recent points) and /api/geo/shop (the catalog with what you
 * own, may wear and can afford). Buying and wearing go through the shop
 * route; the name through the profile route.
 *
 * The page is a header saying who this is and what they hold, at most
 * one line asking for something (sign in, or pick a name), and three
 * tabs. Nothing about the player paints until the profile has answered:
 * it used to print "Player" and a full record first and then swap both,
 * so every visit opened on the wrong name and a jump.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Tag, Users } from 'lucide-react';
import { formatScore, ordinal } from '@/app/lib/geo/distance';
import { ITEM_KINDS } from '@/app/lib/geo/items';
import { VARIANTS, DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';
import {
  LADDERS,
  LADDER_LABELS,
  PROVISIONAL_GAMES,
} from '@/app/lib/geo/rating';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { saveName } from '../lib/useRoom';
import { ago } from '../lib/time';
import Card from './ui/Card';
import Tabs from './ui/Tabs';
import SignInCard from './SignInCard';
import AccountRole from './AccountRole';

const KIND_ORDER = ['pin', 'color', 'title', 'frame', 'reactions'];
const TABS = [
  { id: 'record', label: 'Record' },
  { id: 'shop', label: 'Shop' },
  { id: 'settings', label: 'Settings' },
];
/** One ladder: the rating, the tier, and what was won on it. */
function LadderCard({ ladder, rating, provisionalGames }) {
  const label = ladder === 'duel' ? 'Street multiplayer' : LADDER_LABELS[ladder] || VARIANTS[ladder]?.label || ladder;
  const games = rating?.games || 0;
  if (games < provisionalGames) {
    return (
      <Card pad="sm">
        <p className="text-sm font-medium text-pe-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-pe-subtle">Unplaced</p>
        <p className="mt-1 text-xs text-pe-muted">
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
          Play to place <span aria-hidden="true">→</span>
        </Link>
      </Card>
    );
  }
  return (
    <Card pad="sm">
      <p className="text-sm font-medium text-pe-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-pe-fg">
        {rating.value}
      </p>
      <p className="text-xs text-pe-muted">
        {rating.tier}
        {rating.rank ? ` · #${rating.rank} of ${rating.population}` : ''}
        {rating.accuracy != null ? ` · ${Math.floor(rating.accuracy * 1000) / 10}% accuracy` : ''}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-pe-line pt-3 text-xs">
        <div>
          <dt className="text-pe-subtle">Played</dt>
          <dd className="font-semibold tabular-nums">{games}</dd>
        </div>
        <div>
          <dt className="text-pe-subtle">Won</dt>
          <dd className="font-semibold tabular-nums">{rating.wins}</dd>
        </div>
        <div>
          <dt className="text-pe-subtle">Best</dt>
          <dd className="font-semibold tabular-nums">{rating.peak}</dd>
        </div>
      </dl>
      {rating.streak > 1 ? (
        <p className="mt-2 text-xs font-semibold text-pe-good">
          {rating.streak} wins in a row
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

function ItemCard({ item, busy, onBuy, onEquip, equippedId, index = 0 }) {
  const wearing = equippedId === item.id;
  const tierOnly = Boolean(item.requires?.tier);
  let action = null;
  if (item.kind === 'reactions') {
    action = item.owned ? (
      <span className="text-sm font-semibold text-pe-good">Yours</span>
    ) : null;
  } else if (wearing) {
    action = (
      <span className="text-sm font-semibold text-pe-good">Wearing</span>
    );
  } else if (item.usable) {
    action = (
      <button
        type="button"
        disabled={busy}
        onClick={() => onEquip(item.id)}
        aria-label={`Wear ${item.name}`}
        className="ui-btn ui-btn--secondary ui-btn--sm"
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
        className="ui-btn ui-btn--primary ui-btn--sm"
      >
        Buy for {formatScore(item.price)}
      </button>
    ) : (
      // The balance is at the top of the page. Repeating it on every
      // row of a long list is noise, and it made each row read as a
      // refusal rather than a price.
      <span className="text-sm tabular-nums text-pe-subtle">
        {formatScore(item.price)} points
      </span>
    );
  }
  if (tierOnly && !item.usable)
    buy = (
      <span className="text-xs text-pe-subtle">
        Unlocks at {item.requires.tier} on any ladder
      </span>
    );
  return (
    <li
      style={{ '--i': index }}
      className={`flex items-center gap-3 rounded-xl border p-3 ${wearing ? 'border-pe-accent bg-pe-accent/10' : 'border-pe-line bg-pe-surface'}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pe-raised">
        {item.kind === 'pin' ? (
          <PinPreview style={item.style} fill={item.fill} />
        ) : null}
        {item.kind === 'color' ? (
          <span
            className="h-5 w-5 rounded-full border border-pe-line-strong"
            style={{ backgroundColor: item.value || '#ffffff' }}
          />
        ) : null}
        {item.kind === 'title' ? (
          <Tag className="h-4 w-4 text-pe-muted" />
        ) : null}
        {item.kind === 'frame' ? (
          <span
            className="h-6 w-6 rounded-full bg-pe-line-strong"
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
        <p className="font-semibold text-pe-fg">{item.name}</p>
        <p className="truncate text-sm text-pe-muted">{item.description}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {action}
        {buy}
      </div>
    </li>
  );
}

/** The header's shape before the profile answers, so nothing moves. */
function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="pe-skeleton block h-14 w-14 shrink-0 rounded-full sm:h-16 sm:w-16" />
      <div className="min-w-0 flex-1">
        <span className="pe-skeleton block h-8 w-44" />
        <span className="pe-skeleton mt-2 block h-4 w-60 max-w-full" />
      </div>
    </div>
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
  const nameField = useRef(null);
  const focusName = useRef(false);

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

  // "Choose your name" lands in the field itself, not just on the tab
  // that holds it.
  useEffect(() => {
    if (tab === 'settings' && focusName.current) {
      focusName.current = false;
      nameField.current?.focus();
    }
  }, [tab]);

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
  // How many countries a player has a badge for, and nothing about how
  // many there are to get. The line read "12 of 23 countries", and 23
  // was the number of countries the game covers, which is kept secret
  // (app/lib/geo/modes.js, RETIRED_MODES).
  const countryBadges = profile?.badges?.length || 0;
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

  // A guest who never chose a name is stored as the placeholder, and the
  // page was titled "Player": an account named for them that they never
  // made (founder, 2026-09-17). They are a guest, so that is the title.
  const chosen = profile?.name && profile.name !== DEFAULT_PLAYER_NAME ? profile.name : '';
  const unnamedGuest = Boolean(profile) && !profile.signedIn && !chosen;
  const displayName = chosen || (unnamedGuest ? 'Guest' : profile?.name || name || DEFAULT_PLAYER_NAME);
  const panel = {
    id: 'profile-panel',
    role: 'tabpanel',
    'aria-labelledby': `profile-panel-tab-${tab}`,
    tabIndex: 0,
  };

  return (
    <main className="ui-page">
      {profile ? (
        <header className="pe-fade-in flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pe-raised text-lg font-bold text-pe-fg sm:h-16 sm:w-16 sm:text-xl"
            style={
              view?.frame ? { boxShadow: `0 0 0 3px ${view.frame}` } : undefined
            }
            aria-hidden="true"
          >
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="ui-h1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 break-words" style={view?.color ? { color: view.color } : undefined}>
                {displayName}
              </span>
              {view?.title ? (
                <span className="rounded-full bg-pe-raised px-2.5 py-0.5 text-xs font-semibold text-pe-muted">
                  {view.title}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-pe-muted">
              {/* A profile called "Player" with nothing saying where it
                  came from reads as an account somebody made for you
                  (founder, 2026-09-17: "why does it pretend I have an
                  account named player"). */}
              {profile.signedIn ? 'Signed in' : unnamedGuest ? 'Not signed in' : 'Guest on this browser'}
              {/* The season is Rankings' to explain; on a phone it
                  wrapped this line to three. */}
              {profile.season ? (
                <span data-season className="hidden sm:inline">
                  {' · '}
                  {profile.season.label}, {profile.season.daysLeft}{' '}
                  {profile.season.daysLeft === 1 ? 'day' : 'days'} left
                </span>
              ) : null}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-pe-fg sm:text-3xl">
              {formatScore(points)}
            </p>
            {/* Not just "points": a round score is points too, and a
                rating is a third number. These are the ones the shop
                takes. */}
            <p className="text-xs text-pe-muted sm:text-sm">points to spend</p>
          </div>
        </header>
      ) : (
        <HeaderSkeleton />
      )}

      {profile && !profile.signedIn ? (
        <Card pad="sm" className="pe-fade-in mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pe-muted">
            Your games are saved in this browser only. Sign in to keep them
            on every device.
          </p>
          <Link href="/geo/signin?next=%2Fgeo%2Fme" className="ui-btn ui-btn--primary">
            Sign in
          </Link>
        </Card>
      ) : null}

      {/* A signed-in account still carrying the placeholder renders
          as "Player", which is the same screen the founder rejected
          on a guest: an account that pretends to be named for you
          (2026-09-17: "why does it pretend I have an account named
          player"). The name is not empty in that case - resolveProfile
          stores the placeholder - so this compares against it rather
          than checking for a blank. Every signup path asks for a name
          now, so an account in this state was made before they did. */}
      {profile?.signedIn && (!profile.name || profile.name === DEFAULT_PLAYER_NAME) ? (
        <Card pad="sm" className="pe-fade-in mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pe-muted">Your account has no name yet, so scoreboards show you as Player.</p>
          <button
            type="button"
            onClick={() => {
              focusName.current = true;
              setTab('settings');
            }}
            className="ui-btn ui-btn--primary"
          >
            Choose your name
          </button>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-pe-bad/40 bg-pe-bad/10 px-4 py-3 text-sm text-pe-fg">
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
        className="mt-8"
      />

      {tab === 'record' && !profile && !error ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="pe-skeleton block h-40 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {tab === 'record' && profile && !hasRecord ? (
        <div key="empty" {...panel} className="pe-swap mt-6">
          <Card data-no-record className="py-10 text-center">
            <h2 className="ui-h2">No games yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-pe-muted">
              Your ratings, rated games and country badges show up here
              after your first game.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/geo" className="ui-btn ui-btn--primary">
                <Play size={16} fill="currentColor" aria-hidden="true" />
                Play a game
              </Link>
              <Link href="/geo/rooms" className="ui-btn ui-btn--secondary">
                <Users className="h-4 w-4" aria-hidden="true" />
                Play with a friend
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'record' && profile && hasRecord ? (
        <div key="record" {...panel} className="pe-swap mt-6 grid gap-10">
          {/* Rating: every ladder, with what a player earned on it
              rather than the word for where it sits. */}
          <section data-ratings aria-labelledby="profile-ratings">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="profile-ratings" className="ui-h2">Ratings</h2>
              <Link href="/geo/leaderboard" className="text-sm font-semibold text-pe-accent-fg hover:underline">
                See rankings
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
          </section>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            {/* Recent rated games. The server has sent these with every
                profile since ratings shipped and nothing read them. */}
            <section data-recent aria-labelledby="profile-recent">
              <h2 id="profile-recent" className="ui-h2">Rated games</h2>
              {profile.recent?.length ? (
                <Card pad="none" className="mt-3 overflow-hidden">
                  <ul className="divide-y divide-pe-line text-sm">
                    {profile.recent.map((row, i) => (
                      <li
                        key={`${row.roomId}:${i}`}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          className={`w-12 shrink-0 font-bold tabular-nums ${row.placement === 1 ? 'text-pe-warm' : 'text-pe-fg'}`}
                        >
                          {ordinal(row.placement)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-pe-muted">
                          of {row.players} &middot;{' '}
                          {LADDER_LABELS[row.ladder] ||
                            VARIANTS[row.ladder]?.label ||
                            row.ladder}{' '}
                          &middot; {ago(row.at)}
                        </span>
                        <span
                          className={`shrink-0 font-semibold tabular-nums ${row.delta > 0 ? 'text-pe-good' : row.delta < 0 ? 'text-pe-bad' : 'text-pe-muted'}`}
                        >
                          {row.delta > 0 ? '+' : ''}
                          {row.delta}
                        </span>
                        <span className="w-12 shrink-0 text-right tabular-nums text-pe-muted">
                          {row.after}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <p className="mt-3 text-sm text-pe-muted">
                  None yet. Rated games are{' '}
                  <Link href="/geo/rooms" className="font-semibold text-pe-accent-fg hover:underline">
                    multiplayer
                  </Link>{' '}
                  and{' '}
                  <Link href="/geo/play?mode=ranked" className="font-semibold text-pe-accent-fg hover:underline">
                    ranked solo
                  </Link>
                  .
                </p>
              )}
            </section>

            <section data-badges aria-labelledby="profile-badges">
              <h2 id="profile-badges" className="ui-h2 flex items-baseline justify-between gap-3">
                Country badges
                {countryBadges ? (
                  <span className="text-sm font-normal tabular-nums text-pe-muted">
                    {countryBadges} {countryBadges === 1 ? 'country' : 'countries'}
                  </span>
                ) : null}
              </h2>
              {profile.badges?.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {profile.badges.map((b) => (
                    <li
                      key={b.countryCode}
                      className="flex items-center gap-2 rounded-xl border border-pe-line bg-pe-surface px-3 py-2 text-sm"
                    >
                      <span className="text-xl">{b.flag}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {b.name}
                      </span>
                      <span className="text-xs text-pe-muted">
                        {b.bestKm < 1
                          ? 'under 1 km'
                          : `${Math.round(b.bestKm)} km`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-pe-muted">
                  None yet. A guess within 100 km earns that country&apos;s
                  badge.
                </p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'shop' ? (
        <div key="shop" {...panel} className="pe-swap mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section data-shop aria-labelledby="profile-shop">
            <h2 id="profile-shop" className="ui-h2">Shop</h2>
            <p className="mt-1 text-sm text-pe-muted">
              Points buy how you look. Nothing here changes how you play.
            </p>
            <Tabs
              items={KIND_ORDER.map((k) => ({ id: k, label: ITEM_KINDS[k] }))}
              value={kind}
              onChange={setKind}
              label="Shop sections"
              panelId="shop-panel"
              marker="shop-kind"
              className="mt-4"
            />
            <div id="shop-panel" role="tabpanel" aria-labelledby={`shop-panel-tab-${kind}`} tabIndex={0}>
              {shop ? (
                // Keyed on the kind, so choosing Pins after Colours is a
                // new list that arrives row by row rather than the old
                // rows' text changing under the player's eye.
                <ul key={kind} className="pe-stagger mt-4 grid gap-2">
                  {items.map((item, index) => (
                    <ItemCard
                      index={index}
                      key={item.id}
                      item={item}
                      busy={busy}
                      onBuy={(id) => act('buy', id)}
                      onEquip={(id) => act('equip', id)}
                      equippedId={shop.equipped?.[item.kind]}
                    />
                  ))}
                </ul>
              ) : error ? (
                <p className="mt-4 text-sm text-pe-muted">The shop is closed for now.</p>
              ) : (
                <div className="mt-4 grid gap-2" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="pe-skeleton block h-[68px] rounded-xl" />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Where the points came from, beside what they buy. */}
          <aside data-ledger aria-labelledby="profile-ledger">
            <h2 id="profile-ledger" className="ui-h2">Recent points</h2>
            {profile?.ledger?.length ? (
              <Card pad="none" className="mt-3 overflow-hidden">
                <ul className="divide-y divide-pe-line text-sm">
                  {profile.ledger.map((row, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-pe-fg">
                        {row.reason}{' '}
                        <span className="text-pe-subtle">{ago(row.at)}</span>
                      </span>
                      <span
                        className={`font-semibold tabular-nums ${row.kind === 'earn' ? 'text-pe-good' : 'text-pe-fg'}`}
                      >
                        {row.kind === 'earn' ? '+' : '-'}
                        {row.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <p className="mt-3 text-sm text-pe-muted">
                Nothing yet. Every scored round earns some.
              </p>
            )}
          </aside>
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div key="settings" {...panel} className="pe-swap mt-6 grid items-start gap-6 md:grid-cols-2">
          <Card>
            <h2 className="ui-h2">Your name</h2>
            <p className="mt-1 text-sm text-pe-muted">
              What other players see in rooms and on the rankings.
            </p>
            <form
              method="post"
              onSubmit={saveTheName}
              className="mt-4 flex gap-2"
            >
              <input
                ref={nameField}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                aria-label="Your name"
                autoComplete="nickname"
                className="ui-input min-w-0 flex-1"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="ui-btn ui-btn--secondary shrink-0"
              >
                {savedName ? 'Saved' : 'Save'}
              </button>
            </form>
          </Card>

          {/* Signing in. A Probably Earth account, not a ReunitePets one. */}
          <Card>
            <h2 className="ui-h2">Account</h2>
            {/* Signed in, the card below says what the account does. */}
            {profile?.signedIn ? null : (
              <p className="mt-1 text-sm text-pe-muted">
                This profile is saved in this browser only.
              </p>
            )}
            <div className="mt-4">
              <SignInCard requireName playerName={name} onPlayerNameChange={setName} />
            </div>
          </Card>

          {/* What this account is: tier, and role when it is not the
              ordinary one. Renders for signed-in players only. */}
          <AccountRole />
        </div>
      ) : null}
    </main>
  );
}
