'use client';

/**
 * The member list. Everyone sees names (first name and last initial), roles
 * and divisions, and can leave the force. Founders and leaders also change a
 * member's role or division and remove members, with the API's own rules:
 * the founder's role never changes, only the founder makes or removes
 * leaders, and a founder can leave only once someone else is a leader.
 *
 * A force with no founder or leader (the ones set up automatically from a
 * report start that way) offers its members "Become the leader", through
 * POST .../claim-leadership, which only works while no one leads it.
 *
 * APIs: GET /api/rescue-forces/[id]/members and /divisions, PATCH and DELETE
 * .../members/[memberId], POST .../leave, POST .../claim-leadership.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui';
import { FORCE_ROLE_LABEL } from '@/app/lib/forceRoles';

const MANAGERS = ['FOUNDER', 'LEADER', 'ADMINISTRATOR'];

function fullName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || 'A member';
}

function Avatar({ m }) {
  if (m.profileImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.profileImage} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-midnight-100 font-semibold text-midnight-700">
      {(m.firstName || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function MemberRow({ m, forceId, userId, myRole, divisions, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const isMe = m.userId === userId;
  const canManage = MANAGERS.includes(myRole) && !isMe && m.role !== 'FOUNDER';
  const canRemove = canManage && (m.role !== 'LEADER' || myRole === 'FOUNDER');
  const roleOptions = ['MEMBER', 'COORDINATOR', ...(myRole === 'FOUNDER' || m.role === 'LEADER' ? ['LEADER'] : [])];

  async function update(body) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The change did not save.');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/members/${m.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${m.firstName || 'The member'} was not removed.`);
      onChanged();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar m={m} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-midnight-900">
            {fullName(m)}
            {isMe && <span className="font-normal text-midnight-500"> (you)</span>}
          </p>
          <p className="text-sm text-midnight-500">
            {[FORCE_ROLE_LABEL[m.role] || 'Member', m.division?.name].filter(Boolean).join(' · ')}
          </p>
        </div>
        {busy && <Loader2 size={18} className="shrink-0 animate-spin text-midnight-400" aria-label="Saving" />}
        {canManage && !busy && (
          <Button size="sm" variant="ghost" aria-expanded={managing} onClick={() => setManaging((v) => !v)}>
            {managing ? 'Done' : 'Manage'}
          </Button>
        )}
      </div>

      {canManage && managing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[3.25rem]">
          <label className="sr-only" htmlFor={`role-${m.id}`}>
            Role for {m.firstName}
          </label>
          <select
            id={`role-${m.id}`}
            value={['LEADER', 'COORDINATOR', 'MEMBER'].includes(m.role) ? m.role : 'MEMBER'}
            disabled={busy}
            onChange={(e) => update({ role: e.target.value })}
            className="rounded-lg border border-midnight-200 bg-white px-2.5 py-2 text-sm text-midnight-800"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {FORCE_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {divisions.length > 0 && (
            <>
              <label className="sr-only" htmlFor={`division-${m.id}`}>
                Division for {m.firstName}
              </label>
              <select
                id={`division-${m.id}`}
                value={m.division?.id || ''}
                disabled={busy}
                onChange={(e) => update({ divisionId: e.target.value || null })}
                className="rounded-lg border border-midnight-200 bg-white px-2.5 py-2 text-sm text-midnight-800"
              >
                <option value="">No division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {canRemove &&
            (confirming ? (
              <span className="inline-flex items-center gap-2 text-sm">
                Remove {m.firstName}?
                <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                  Remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" leftIcon={UserMinus} onClick={() => setConfirming(true)}>
                Remove
              </Button>
            ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 pl-[3.25rem] text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

function ClaimLeadership({ forceId, onClaimed }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/claim-leadership`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not go through. Try again.');
      router.refresh();
      onClaimed();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl bg-flash-50 p-4 ring-1 ring-flash-200 sm:p-5">
      <h2 className="text-base font-semibold text-midnight-900">This force has no leader yet</h2>
      <p className="mt-1 text-sm text-midnight-700">
        A leader posts announcements, changes the force&apos;s settings and divisions, and manages its members. Any member can take
        it on while no one else has.
      </p>
      <Button className="mt-3" onClick={claim} loading={busy}>
        Become the leader
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function LeaveForce({ forceId, forceName }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/leave`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'You were not taken out of the force. Try again.');
      router.push(`/rescue-forces/${forceId}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-midnight-200 sm:p-5">
      <h2 className="text-base font-semibold text-midnight-900">Leave {forceName}</h2>
      <p className="mt-1 text-sm text-midnight-600">
        You will stop getting this force&apos;s alerts and lose access to its updates and chat. You can join again later.
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" onClick={leave} loading={busy}>
            Yes, leave
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button className="mt-3" variant="outline" onClick={() => setConfirming(true)}>
          Leave this force
        </Button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

export default function MembersClient({ forceId, forceName, userId, myRole }) {
  const [members, setMembers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    try {
      const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
      const [m, d] = await Promise.all([get(`/api/rescue-forces/${forceId}/members`), get(`/api/rescue-forces/${forceId}/divisions`)]);
      setMembers(m.members || []);
      setDivisions(d.divisions || []);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [forceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-midnight-500" aria-busy="true">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Loading members
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
        <p className="text-midnight-700">The member list did not load.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => { setStatus('loading'); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  const leaderless = members.length > 0 && !members.some((m) => MANAGERS.includes(m.role));

  return (
    <div className="space-y-6">
      {leaderless && myRole && <ClaimLeadership forceId={forceId} onClaimed={load} />}
      <section aria-labelledby="member-count">
        <h2 id="member-count" className="text-lg font-semibold text-midnight-900">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </h2>
        <ul className="mt-3 divide-y divide-midnight-100 overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
          {members.map((m) => (
            <MemberRow key={m.id} m={m} forceId={forceId} userId={userId} myRole={myRole} divisions={divisions} onChanged={load} />
          ))}
        </ul>
      </section>
      {myRole && <LeaveForce forceId={forceId} forceName={forceName} />}
    </div>
  );
}
