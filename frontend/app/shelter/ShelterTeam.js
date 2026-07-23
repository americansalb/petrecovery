'use client';

/**
 * The shelter team as one surface: the owner's implicit seat first, then
 * every invited seat with its state (joined date, or waiting to accept),
 * and the invite form as the last row. Names come from linked accounts;
 * an invite that predates the account shows the email until they join.
 */

import { useEffect, useState } from 'react';
import { Send, Loader2, X } from 'lucide-react';

const ROLE_LABELS = { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' };

function initialsOf(name, email) {
  const clean = (name || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] || '' : '')).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
}

function shortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function Avatar({ name, email, variant = 'member' }) {
  const styles = {
    owner: 'bg-midnight-900 text-white',
    member: 'bg-slate-100 text-midnight-500',
    pending: 'bg-white border border-dashed border-midnight-300 text-midnight-400',
  };
  return (
    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${styles[variant]}`}>
      {initialsOf(name, email)}
    </span>
  );
}

export default function ShelterTeam() {
  const [state, setState] = useState({ loading: true, failed: false, owner: null, members: [], myRole: null });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STAFF');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/shelter/members');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setState({
        loading: false,
        failed: false,
        owner: data.owner || null,
        members: data.members || [],
        myRole: data.myRole,
      });
    } catch {
      setState({ loading: false, failed: true, owner: null, members: [], myRole: null });
    }
  };

  useEffect(() => { load(); }, []);

  const canManage = ['OWNER', 'MANAGER'].includes(state.myRole || '');

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shelter/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setEmail('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setRemoving(id);
    try {
      await fetch(`/api/shelter/members/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setRemoving('');
    }
  };

  if (state.loading) return null;
  if (state.failed) {
    return (
      <p className="text-sm text-midnight-500">
        Couldn&rsquo;t load your team just now. Refresh the page to try again.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
      {state.owner && (
        <div className="flex items-center gap-3.5 px-4 py-3">
          <Avatar name={state.owner.name} email={state.owner.email} variant="owner" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-midnight-900 text-[15px] leading-tight truncate">
              {state.owner.name || state.owner.email}
              {state.myRole === 'OWNER' && <span className="text-midnight-400 font-medium"> (you)</span>}
            </p>
            <p className="text-[13px] text-midnight-400 truncate">
              {[
                state.owner.name ? state.owner.email : null,
                state.owner.claimedAt
                  ? `runs this shelter since ${shortDate(state.owner.claimedAt)}`
                  : 'runs this shelter',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className="text-[13px] font-medium text-midnight-600 shrink-0">Owner</span>
        </div>
      )}

      {state.members.map((m) => (
        <div key={m.id} className="flex items-center gap-3.5 px-4 py-3">
          <Avatar name={m.name} email={m.email} variant={m.status === 'ACTIVE' ? 'member' : 'pending'} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-midnight-900 text-[15px] leading-tight truncate">{m.name || m.email}</p>
            {m.status === 'ACTIVE' ? (
              <p className="text-[13px] text-midnight-400 truncate">
                {[
                  m.name ? m.email : null,
                  m.respondedAt ? `joined ${shortDate(m.respondedAt)}` : 'active seat',
                ].filter(Boolean).join(' · ')}
              </p>
            ) : (
              <p className="text-[13px] text-amber-600 truncate">
                Invited {shortDate(m.createdAt) || 'recently'} · waiting for them to accept
              </p>
            )}
          </div>
          <span className="text-[13px] font-medium text-midnight-600 shrink-0">{ROLE_LABELS[m.role] || m.role}</span>
          {canManage && (
            <button
              onClick={() => remove(m.id)}
              disabled={removing === m.id}
              aria-label={`Remove ${m.email}`}
              className="text-midnight-300 hover:text-red-600 disabled:opacity-50 p-1 shrink-0"
            >
              {removing === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          )}
        </div>
      ))}

      {canManage && (
        /* globals.css forces email inputs + selects to width:100%, so the
           layout is shaped by grid tracks, not input width utilities */
        <form onSubmit={invite} className="px-4 py-3 bg-slate-50/60 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@shelter.org"
            className="border border-midnight-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-flash-400"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Role"
            className="border border-midnight-200 rounded-lg px-2.5 py-2 text-sm bg-white"
          >
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-semibold rounded-lg px-3.5 py-2 disabled:opacity-50 transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Invite
          </button>
          {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
