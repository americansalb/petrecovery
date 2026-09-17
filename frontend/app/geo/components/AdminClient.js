'use client';

/**
 * /geo/admin: the backend.
 *
 * Numbers at the top, accounts in the middle, rooms at the bottom. It
 * is a working screen rather than a dashboard: everything on it is
 * either a figure somebody acts on or a control that changes something.
 *
 * Authorisation is the server's. This screen renders whatever the API
 * gives it and shows the refusal when the API refuses, so a player who
 * types the URL gets a clear "not an admin" instead of a blank page or,
 * worse, a page that looks like it worked.
 */

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Loader2, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';
import { ROLES, TIERS } from '@/app/lib/geo/server/roles';

const DENIALS = {
  signed_out: 'Sign in first.',
  no_account: 'That session does not match an account.',
  suspended: 'This account is suspended.',
  not_admin: 'This account is not an admin.',
};

function Figure({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ocean-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-white/60">{hint}</p> : null}
    </div>
  );
}

export default function AdminClient() {
  const [denied, setDenied] = useState('');
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setNote('');
    const head = await fetch('/api/geo/admin/overview', { cache: 'no-store' });
    if (!head.ok) {
      const body = await head.json().catch(() => ({}));
      setDenied(body.error || 'not_admin');
      return;
    }
    setDenied('');
    setOverview((await head.json()).overview);
    const [a, r] = await Promise.all([
      fetch(`/api/geo/admin/accounts?q=${encodeURIComponent(query)}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => ({})),
      fetch('/api/geo/admin/rooms', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({})),
    ]);
    setAccounts(a.accounts || []);
    setRooms(r.rooms || []);
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (accountId, patch) => {
    setBusy(accountId);
    setNote('');
    const response = await fetch('/api/geo/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, ...patch }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy('');
    if (!response.ok) {
      setNote(body.error === 'cannot_suspend_self' ? 'You cannot suspend your own account.' : `Refused: ${body.error || response.status}`);
      return;
    }
    setAccounts((rows) => rows.map((row) => (row.id === accountId ? { ...row, ...body.account } : row)));
  };

  if (denied) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-clay-300" />
        <h1 className="mt-4 text-2xl font-bold text-white">Admin</h1>
        <p className="mt-2 text-white/60">{DENIALS[denied] || 'You cannot open this page.'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-clay-300">Probably Earth</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Admin</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {overview ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Site">
          <Figure label="Accounts" value={overview.accounts} hint={`${overview.supporters} supporters, ${overview.suspended} suspended`} />
          <Figure label="Players" value={overview.profiles} hint={`${overview.newProfiles} new today`} />
          <Figure label="Rooms live" value={overview.liveRooms} hint={`${overview.rooms} ever`} />
          <Figure label="Rounds today" value={overview.roundsToday} hint={`${overview.challengeEntriesThisWeek} challenge entries this week`} />
        </section>
      ) : null}

      <section className="mt-10" aria-label="Accounts">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Users className="h-5 w-5 text-ocean-300" />
            Accounts
          </h2>
          <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-ocean-900/60 px-3 py-2">
            <Search className="h-4 w-4 text-white/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by email"
              className="w-56 bg-transparent text-sm outline-none placeholder:text-white/40"
              aria-label="Search accounts by email"
            />
          </label>
        </div>

        {note ? <p className="mt-3 rounded-xl border border-clay-400/40 bg-clay-500/10 px-3 py-2 text-sm text-clay-200">{note}</p> : null}

        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-ocean-900/60">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Players</th>
                <th className="px-4 py-2">Last seen</th>
                <th className="px-4 py-2 text-right">Suspend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {accounts.map((account) => (
                <tr key={account.id} className={account.suspended ? 'bg-clay-50/60' : ''}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-white">{account.email}</span>
                    {account.storedRole !== account.role ? (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-ocean-200">by config</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={account.role}
                      disabled={busy === account.id || account.storedRole !== account.role}
                      onChange={(event) => change(account.id, { role: event.target.value })}
                      className="rounded-lg border border-white/15 bg-ocean-900/60 px-2 py-1 text-sm disabled:opacity-50"
                      aria-label={`Role for ${account.email}`}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={account.tier}
                      disabled={busy === account.id}
                      onChange={(event) => change(account.id, { tier: event.target.value })}
                      className="rounded-lg border border-white/15 bg-ocean-900/60 px-2 py-1 text-sm disabled:opacity-50"
                      aria-label={`Tier for ${account.email}`}
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-white/70">{account.players.map((p) => p.name).join(', ') || '-'}</td>
                  <td className="px-4 py-2 tabular-nums text-white/60">{account.lastSeenAt.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy === account.id}
                      onClick={() => change(account.id, { suspended: !account.suspended, reason: account.suspended ? '' : 'Suspended from the admin screen' })}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${account.suspended ? 'bg-forest-600 text-white hover:bg-forest-500' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}
                    >
                      {busy === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : account.suspended ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {account.suspended ? 'Restore' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
              {!accounts.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                    {query ? 'No account matches that.' : 'Nobody has signed in yet.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-label="Rooms">
        <h2 className="text-lg font-bold text-white">Rooms</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-ocean-900/60">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Variant</th>
                <th className="px-4 py-2 text-right">Players</th>
                <th className="px-4 py-2 text-right">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rooms.map((room) => (
                <tr key={room.code}>
                  <td className="px-4 py-2 font-mono font-semibold text-white">{room.code}</td>
                  <td className="px-4 py-2 text-white/70">{room.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${room.status === 'playing' ? 'bg-forest-500/20 text-forest-200' : room.status === 'lobby' ? 'bg-white/10 text-ocean-200' : 'bg-white/10 text-white/70'}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-white/70">{room.variant}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{room.players}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/60">{room.lastActiveAt.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
              {!rooms.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                    No rooms yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
