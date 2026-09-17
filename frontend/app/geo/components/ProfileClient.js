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
import { Award, Gauge, Medal, ShoppingBag, Tag, Trophy, Users } from 'lucide-react';
import { formatScore } from '@/app/lib/geo/distance';
import { ITEM_KINDS } from '@/app/lib/geo/items';
import { VARIANTS } from '@/app/lib/geo/rooms';
import { LADDERS, LADDER_LABELS, PROVISIONAL_GAMES } from '@/app/lib/geo/rating';
import { ensureProfile, profileHeaders } from '../lib/profile';
import { loadName, saveName } from '../lib/useRoom';
import { ago } from '../lib/time';
import SignInCard from './SignInCard';
import AccountRole from './AccountRole';

const KIND_ORDER = ['pin', 'color', 'title', 'frame', 'reactions'];

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
      {style === 'ring' ? <circle r="9" fill={fill} fillOpacity="0.25" stroke={fill} strokeWidth="3" /> : null}
      {style === 'star' ? <path d="M 0 -11 L 3.2 -3.6 L 11 -3.4 L 4.9 1.6 L 6.8 9.2 L 0 4.8 L -6.8 9.2 L -4.9 1.6 L -11 -3.4 L -3.2 -3.6 Z" fill={fill} stroke={stroke} strokeWidth="1.5" /> : null}
      {style === 'diamond' ? <path d="M 0 -11 L 10 0 L 0 11 L -10 0 Z" fill={fill} stroke={stroke} strokeWidth="2" /> : null}
      {style === 'dot' ? <circle r="9" fill={fill} stroke={stroke} strokeWidth="2" /> : null}
    </svg>
  );
}

function ItemCard({ item, points, busy, onBuy, onEquip, equippedId }) {
  const wearing = equippedId === item.id;
  const tierOnly = Boolean(item.requires?.tier);
  let action = null;
  if (item.kind === 'reactions') {
    action = item.owned ? <span className="text-xs font-semibold text-forest-300">Yours</span> : null;
  } else if (wearing) {
    action = <span className="text-xs font-semibold text-forest-300">Wearing</span>;
  } else if (item.usable) {
    action = (
      <button type="button" disabled={busy} onClick={() => onEquip(item.id)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5 disabled:opacity-50">
        Wear
      </button>
    );
  }
  let buy = null;
  if (!item.owned && !item.free && !tierOnly) {
    buy = item.affordable ? (
      <button type="button" disabled={busy} onClick={() => onBuy(item.id)} className="rounded-lg bg-ocean-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ocean-800 disabled:opacity-50">
        Buy for {formatScore(item.price)}
      </button>
    ) : (
      // The balance is at the top of the page. Repeating it on every
      // row of a long list is noise, and it made each row read as a
      // refusal rather than a price.
      <span className="text-xs text-white/60">{formatScore(item.price)} points</span>
    );
  }
  if (tierOnly && !item.usable) buy = <span className="text-xs text-white/60">Free at {item.requires.tier} on either ladder</span>;
  return (
    <li className={`flex items-center gap-3 rounded-xl border p-3 ${wearing ? 'border-clay-400 bg-ocean-950' : 'border-white/10 bg-ocean-900/60'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
        {item.kind === 'pin' ? <PinPreview style={item.style} fill={item.fill} /> : null}
        {item.kind === 'color' ? <span className="h-5 w-5 rounded-full border border-white/15" style={{ backgroundColor: item.value || '#ffffff' }} /> : null}
        {item.kind === 'title' ? <Tag className="h-4 w-4 text-white/60" /> : null}
        {item.kind === 'frame' ? <span className="h-6 w-6 rounded-full bg-sand-300" style={item.value ? { boxShadow: `0 0 0 3px ${item.value}` } : undefined} /> : null}
        {item.kind === 'reactions' ? <span className="text-sm">{(item.emoji || []).slice(0, 2).join('')}</span> : null}
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
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('pin');

  const loadShop = async () => {
    const res = await fetch('/api/geo/shop', { headers: profileHeaders(), cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Could not load the shop');
    setShop(json.shop);
  };

  useEffect(() => {
    let alive = true;
    setName(loadName());
    ensureProfile(loadName())
      .then(async (p) => {
        if (!alive) return;
        setProfile(p);
        if (!name && p?.name) setName(p.name);
        await loadShop();
      })
      .catch((e) => alive && setError(e.message || 'Could not load your profile'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setProfile((prev) => (prev ? { ...prev, points: json.shop.points, equipped: json.shop.view } : prev));
    } catch (err) {
      setError(err.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo(() => (shop?.items || []).filter((i) => i.kind === kind), [shop, kind]);
  const view = shop?.view || profile?.equipped || null;
  const points = shop?.points ?? profile?.points ?? 0;

  return (
    <div className="min-h-screen bg-ocean-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-clay-500 text-xl font-bold text-white"
            style={view?.frame ? { boxShadow: `0 0 0 4px ${view.frame}` } : undefined}
            aria-hidden="true"
          >
            {initialsOf(profile?.name || name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/60">Your profile</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
              <span style={view?.color ? { color: view.color } : undefined}>{profile?.name || name || 'Player'}</span>
              {view?.title ? <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white/60">{view.title}</span> : null}
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {profile ? (profile.signedIn ? 'On your Probably Earth account, so it follows you to other devices.' : 'In this browser only. Sign in below to keep it across devices.') : 'Loading'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">{formatScore(points)}</p>
            {/* Not just "points": a round score is points too, and a
                rating is a third number. Each one says which it is. */}
            <p className="text-sm text-white/60">cosmetic points</p>
          </div>
        </header>

        {error ? <p className="mt-4 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-2 text-sm text-red-200">{error}</p> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            {/* Shop */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5" data-shop>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                <ShoppingBag className="h-4 w-4" />
                Shop
              </h2>
              <p className="mt-2 text-sm text-white/60">Points buy how you look in the game. Nothing here changes how you play.</p>
              <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Shop sections">
                {KIND_ORDER.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${kind === k ? 'bg-ocean-900 text-white shadow' : 'text-white/70 hover:bg-ocean-900/60'}`}>
                    {ITEM_KINDS[k]}
                  </button>
                ))}
              </div>
              {shop ? (
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} points={points} busy={busy} onBuy={(id) => act('buy', id)} onEquip={(id) => act('equip', id)} equippedId={shop.equipped?.[item.kind]} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">{error ? 'The shop is closed for now.' : 'Loading the shop'}</p>
              )}
            </section>

            {/* Badges */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5" data-badges>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                <Award className="h-4 w-4" />
                Badges
              </h2>
              <p className="mt-2 text-sm text-white/60">A guess within 100 km of the answer earns that country&apos;s badge, once, with your closest miss kept. Mars and the Moon come from calling a Not Earth round right.</p>
              {profile?.badges?.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.badges.map((b) => (
                    <li key={b.countryCode} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${b.notEarth ? 'border-clay-400/40 bg-clay-500/10' : 'border-white/10'}`}>
                      <span className="text-xl">{b.flag}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
                      <span className="text-xs text-white/60">{b.notEarth ? 'called it' : b.bestKm < 1 ? 'under 1 km' : `${Math.round(b.bestKm)} km`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-white/60">None yet.</p>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {/* Signing in. A Probably Earth account, not a ReunitePets one. */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Account</h2>
              <div className="mt-3">
                <SignInCard />
              </div>
            </section>

            {/* What this account is: tier, and role when it is not the
                ordinary one. Renders for signed-in players only. */}
            <AccountRole />

            {/* Name */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Your name</h2>
              <form method="post" onSubmit={saveTheName} className="mt-3 flex gap-2">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} aria-label="Your name" className="w-full rounded-xl border border-white/15 bg-ocean-900/60 px-3 py-2 text-sm" />
                <button type="submit" disabled={busy || !name.trim()} className="rounded-xl bg-ocean-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ocean-800 disabled:opacity-50">
                  {savedName ? 'Saved' : 'Save'}
                </button>
              </form>
              <p className="mt-2 text-xs text-white/60">What rooms and the boards show.</p>
            </section>

            {/* Rating */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                <Medal className="h-4 w-4" />
                Rating
              </h2>
              {/* Every ladder, not two of the three. Ranked solo is the
                  one a player can reach without arranging a room, so
                  leaving it out hid the rating most people have. */}
              {profile ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {LADDERS.map((ladder) => {
                    const r = profile.ratings?.[ladder] || {};
                    const games = r.games || 0;
                    const placements = Math.max(0, (profile.provisionalGames ?? PROVISIONAL_GAMES) - games);
                    return (
                      <div key={ladder}>
                        <dt className="text-white/60">{LADDER_LABELS[ladder] || VARIANTS[ladder]?.label || ladder}</dt>
                        {games ? (
                          <>
                            <dd className="text-lg font-bold tabular-nums">
                              {r.value} <span className="text-xs font-semibold text-white/60">{r.tier}{r.provisional ? ', provisional' : ''}</span>
                            </dd>
                            <dd className="text-xs text-white/60">
                              {placements ? `${placements} more to be placed` : `${games} rated ${games === 1 ? 'game' : 'games'}`}
                            </dd>
                          </>
                        ) : (
                          <>
                            <dd className="text-lg font-bold text-white/70">Unplaced</dd>
                            <dd className="text-xs text-white/60">
                              Placement games: 0 of {profile.provisionalGames ?? PROVISIONAL_GAMES}
                            </dd>
                          </>
                        )}
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/geo/leaderboard" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5">
                  <Trophy className="h-3.5 w-3.5" />
                  Rankings
                </Link>
                <Link href="/geo/rooms" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5">
                  <Users className="h-3.5 w-3.5" />
                  Rooms
                </Link>
              </div>
            </section>

            {/* Today */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                <Gauge className="h-4 w-4" />
                Today
              </h2>
              {profile?.usage ? (
                <p className="mt-2 text-sm text-white/70">
                  <span className="font-semibold text-white">{profile.usage.rounds}</span> rounds today. Nothing is
                  capped for ordinary play. Points earn on the first 50 rounds of the day.
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/60">Loading</p>
              )}
            </section>

            {/* Recent points */}
            <section className="rounded-2xl border border-white/10 bg-ocean-900/60 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Recent points</h2>
              {profile?.ledger?.length ? (
                <ul className="mt-3 divide-y divide-white/10 text-sm">
                  {profile.ledger.map((row, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-white/70">
                        {row.reason} <span className="text-white/40">{ago(row.at)}</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${row.kind === 'earn' ? 'text-forest-300' : 'text-white'}`}>
                        {row.kind === 'earn' ? '+' : '-'}
                        {row.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-white/60">Nothing yet. Every scored round earns some.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
