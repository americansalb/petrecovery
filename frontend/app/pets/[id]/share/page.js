'use client';

/**
 * People: who can see and do what.
 *
 * Join requests come first, since someone is waiting on you, then the
 * team, then the invite form and the public view link. Owners manage;
 * caregivers and viewers get a short note instead of an error.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { X, Loader2, Check } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { cn } from '@/components/ui';
import { usePet } from '@/app/components/care/PetProvider';

function displayNameOf(share) {
  return [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ') || share.email;
}

export default function PeoplePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;
  const { pet: ctxPet, access } = usePet();

  const [pet, setPet] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CAREGIVER');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [linkUrl, setLinkUrl] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/share`);
    }
  }, [status, router, petId]);

  const fetchShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}/shares`);
      const data = await res.json();
      if (!res.ok) return;
      setPet(data.pet);
      setShares(data.shares);
    } catch { /* tolerated: non-owner or offline */ } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) fetchShares();
  }, [status, petId, fetchShares]);

  useEffect(() => {
    if (status !== 'authenticated' || !petId) return;
    fetch(`/api/pets/${petId}/share-link`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLinkUrl(data?.url || null))
      .catch(() => {});
  }, [status, petId]);

  const absoluteLink = linkUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${linkUrl}` : null;

  const setLink = async (method) => {
    setLinkBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/share-link`, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update the link');
      setLinkUrl(data.url || null);
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusy(false);
    }
  };

  const copyLink = async () => {
    if (!absoluteLink) return;
    try {
      await navigator.clipboard.writeText(absoluteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const approve = async (share) => {
    setBusyId(share.id);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setShares((prev) => prev.map((s) => (s.id === share.id ? data.share : s)));
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setShares((prev) => [...prev, data.share]);
      setSuccess(data.message);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (share, newRole) => {
    if (newRole === share.role) return;
    setBusyId(share.id);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setShares((prev) => prev.map((s) => (s.id === share.id ? data.share : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (share) => {
    setBusyId(share.id);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="px-4 py-20 flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const petName = pet?.name || ctxPet?.name || 'this pet';
  const chip = (active) => cn(
    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'
  );

  // Non-owners get a short note; the roster is the owner's to manage.
  if (access && access !== 'OWNER') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-[15px] text-neutral-900">You help care for {petName}.</p>
        <p className="text-[15px] text-neutral-500 mt-1">
          {access === 'CAREGIVER'
            ? 'You can log doses on Today and keep the record up to date. Only the owner manages who has access.'
            : `You can read ${petName}'s record and schedule. Only the owner manages who has access.`}
        </p>
      </div>
    );
  }

  const active = shares.filter((s) => s.status === 'ACTIVE');
  const pending = shares.filter((s) => s.status === 'PENDING');
  const requests = shares.filter((s) => s.status === 'REQUESTED');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 text-red-700 px-4 py-3 mb-4 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 text-emerald-700 px-4 py-3 mb-4 text-sm">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* Join requests: someone is waiting on you, always first */}
      {requests.length > 0 && (
        <section className="mb-8">
          <p className="text-[13px] font-medium text-neutral-500 mb-1">Requests to join</p>
          <div className="divide-y divide-neutral-100">
            {requests.map((share) => (
              <div key={share.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-neutral-900 truncate">{displayNameOf(share)}</p>
                  <p className="text-[13px] text-neutral-500 truncate">Asked to join as a caregiver</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => remove(share)}
                    disabled={busyId === share.id}
                    className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => approve(share)}
                    disabled={busyId === share.id}
                    className="rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-1.5 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    {busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The team */}
      <section className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-3">People</h1>
        {active.length === 0 && pending.length === 0 ? (
          <p className="text-[15px] text-neutral-500">Just you so far. Invite someone below to share the load.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {[...active, ...pending].map((share) => {
              const isPending = share.status === 'PENDING';
              return (
                <div key={share.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-neutral-900 truncate">{displayNameOf(share)}</p>
                    <p className="text-[13px] text-neutral-500 truncate">
                      {share.role === 'CAREGIVER' ? 'Caregiver' : 'Viewer'}{isPending && ', invited'}
                    </p>
                  </div>
                  <select
                    value={share.role}
                    onChange={(e) => changeRole(share, e.target.value)}
                    disabled={busyId === share.id}
                    aria-label={`Role for ${share.email}`}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:outline-none focus:border-neutral-900 disabled:opacity-50"
                  >
                    <option value="CAREGIVER">Caregiver</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    onClick={() => remove(share)}
                    disabled={busyId === share.id}
                    className="text-[13px] font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 shrink-0"
                    aria-label={`Remove ${share.email}`}
                  >
                    {busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Invite */}
      <section className="mb-8">
        <p className="text-[13px] font-medium text-neutral-500 mb-2">Invite someone</p>
        <form onSubmit={invite} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            aria-label="Email to invite"
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRole('CAREGIVER')} className={chip(role === 'CAREGIVER')}>Caregiver</button>
            <button type="button" onClick={() => setRole('VIEWER')} className={chip(role === 'VIEWER')}>Viewer</button>
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="ml-auto rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : 'Invite'}
            </button>
          </div>
          <p className="text-[13px] text-neutral-500">
            A caregiver logs doses and keeps the record; a viewer can only read it.
          </p>
        </form>
      </section>

      {/* View link */}
      <section>
        <p className="text-[13px] font-medium text-neutral-500 mb-2">View link</p>
        {linkUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={absoluteLink || ''}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-[13px] text-neutral-500 focus:outline-none"
                aria-label="Public view link"
              />
              <button
                onClick={copyLink}
                className="shrink-0 rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-2.5 hover:border-neutral-900 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLink('POST')}
                disabled={linkBusy}
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
              >
                New link
              </button>
              <button
                onClick={() => setLink('DELETE')}
                disabled={linkBusy}
                className="text-[13px] font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                Turn off
              </button>
            </div>
            <p className="text-[13px] text-neutral-500">
              Anyone with the link can read {petName}'s page and ask to join. You approve every request here.
            </p>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setLink('POST')}
              disabled={linkBusy}
              className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-2 hover:border-neutral-900 transition-colors disabled:opacity-50"
            >
              {linkBusy ? 'Creating...' : 'Create view link'}
            </button>
            <p className="text-[13px] text-neutral-500 mt-2">
              A link any vet or sitter can read without an account.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
