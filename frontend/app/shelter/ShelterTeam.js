'use client';

/**
 * Shelter staff seats on the dashboard: list the team, invite by email
 * (owner/manager only), remove seats. Invites stay pending until the
 * invitee accepts from their own dashboard.
 */

import { useEffect, useState } from 'react';
import { Users, Send, Loader2, X } from 'lucide-react';

const ROLE_LABELS = { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' };

export default function ShelterTeam({ hideHeading = false }) {
  const [state, setState] = useState({ loading: true, members: [], myRole: null });
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
      setState({ loading: false, members: data.members || [], myRole: data.myRole });
    } catch {
      setState({ loading: false, members: [], myRole: null });
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

  return (
    <div>
      {!hideHeading && (
        <>
          <h2 className="text-lg font-bold text-midnight-900 mb-1 inline-flex items-center gap-2">
            <Users className="w-5 h-5" /> Your team
          </h2>
          <p className="text-sm text-midnight-600 mb-4">
            Everyone on the team can manage animals, health records, adoptions, and matches.
          </p>
        </>
      )}

      {state.members.length > 0 && (
        <ul className="space-y-2 mb-4">
          {state.members.map((m) => (
            <li key={m.id} className="rounded-xl border border-midnight-100 bg-white px-4 py-2.5 flex items-center gap-3">
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-midnight-900">{m.email}</span>
              <span className="text-xs font-semibold text-midnight-500">{ROLE_LABELS[m.role] || m.role}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {m.status === 'ACTIVE' ? 'Active' : 'Invited'}
              </span>
              {canManage && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={removing === m.id}
                  aria-label={`Remove ${m.email}`}
                  className="text-midnight-400 hover:text-red-600 disabled:opacity-50 p-1"
                >
                  {removing === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        /* globals.css forces email inputs + selects to width:100%, so the
           layout is shaped by grid tracks, not input width utilities */
        <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@shelter.org"
            className="border border-midnight-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
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
