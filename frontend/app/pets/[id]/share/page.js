'use client';

/**
 * Pet Sharing Management
 *
 * Route: /pets/[id]/share (owner only)
 * Invite family / sitters / co-caregivers by email, manage their roles,
 * see pending invites, and revoke access.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UserPlus, X, Loader2, PawPrint, Mail, Clock,
  HeartHandshake, Eye, Trash2, Check, Users, Link2, Copy, RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, Badge, cn } from '@/components/ui';

const ROLE_OPTIONS = [
  {
    value: 'CAREGIVER',
    label: 'Caregiver',
    icon: HeartHandshake,
    description: 'Can track + log medications and view the profile',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    icon: Eye,
    description: 'Can see the profile and med schedule, read-only',
  },
];

function initialsOf(share) {
  const name = [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ');
  if (name) return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return share.email.slice(0, 2).toUpperCase();
}

function PersonRow({ share, busy, onRoleChange, onRemove }) {
  const displayName = [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ');
  const pending = share.status === 'PENDING';

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
        pending ? 'bg-midnight-100 text-midnight-400' : 'bg-flash-100 text-flash-700'
      )}>
        {initialsOf(share)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-midnight-900 text-sm truncate">
          {displayName || share.email}
        </p>
        <p className="text-xs text-midnight-500 truncate">
          {displayName ? share.email : pending ? 'Waiting for them to accept' : ''}
          {displayName && pending && ' · invite pending'}
        </p>
      </div>

      {pending && <Badge variant="warning" size="sm" icon={Clock}>Pending</Badge>}

      <select
        value={share.role}
        onChange={(e) => onRoleChange(share, e.target.value)}
        disabled={busy}
        aria-label={`Role for ${share.email}`}
        className="text-xs font-semibold rounded-lg border border-midnight-200 bg-white px-2 py-1.5 text-midnight-700 focus:outline-none focus:ring-2 focus:ring-flash-400 disabled:opacity-50"
      >
        <option value="CAREGIVER">Caregiver</option>
        <option value="VIEWER">Viewer</option>
      </select>

      <button
        onClick={() => onRemove(share)}
        disabled={busy}
        className="p-2 text-midnight-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        title={pending ? 'Cancel invite' : 'Remove access'}
        aria-label={`Remove ${share.email}`}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </div>
  );
}

export default function PetSharePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CAREGIVER');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Public view link
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
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPet(data.pet);
      setShares(data.shares);
    } catch (err) {
      setError(err.message);
    } finally {
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
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const active = shares.filter((s) => s.status === 'ACTIVE');
  const pending = shares.filter((s) => s.status === 'PENDING');
  const requests = shares.filter((s) => s.status === 'REQUESTED');

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg my-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg my-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-2"><Check size={16} /> {success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800"><X size={18} /></button>
          </div>
        )}

        {/* Invite form */}
        <Card padding="lg" className="mt-6 mb-6">
          <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-4">
            <UserPlus size={18} className="text-midnight-400" /> Invite someone
          </h2>
          <form onSubmit={invite} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their@email.com"
                className="w-full rounded-xl border border-midnight-300 pl-10 pr-3.5 py-2.5 text-midnight-900 text-sm placeholder:text-midnight-400 focus:outline-none focus:ring-2 focus:ring-flash-400 focus:border-flash-400 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    'text-left rounded-xl border-2 p-3.5 transition-colors',
                    role === opt.value
                      ? 'border-flash-400 bg-flash-50'
                      : 'border-midnight-200 bg-white hover:border-midnight-300'
                  )}
                >
                  <span className="flex items-center gap-2 font-bold text-sm text-midnight-900 mb-1">
                    <opt.icon size={15} className={role === opt.value ? 'text-flash-600' : 'text-midnight-400'} />
                    {opt.label}
                  </span>
                  <span className="text-xs text-midnight-500">{opt.description}</span>
                </button>
              ))}
            </div>

            <Button type="submit" variant="primary" loading={inviting} disabled={!email.trim()} fullWidth leftIcon={UserPlus}>
              Send invite
            </Button>
            <p className="text-xs text-midnight-400 text-center">
              No account with that email yet? They&apos;ll get access as soon as they sign up with it and accept.
            </p>
          </form>
        </Card>

        {/* View link */}
        <Card padding="lg" className="mb-6">
          <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-1">
            <Link2 size={18} className="text-midnight-400" /> View link
          </h2>
          <p className="text-sm text-midnight-500 mb-4">
            Anyone with the link can see {pet?.name}&apos;s care page, no account needed.
            They can ask to join as a caretaker; you approve every request here.
          </p>

          {linkUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={absoluteLink || ''}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 rounded-xl border border-midnight-300 px-3.5 py-2.5 text-midnight-700 text-sm bg-midnight-50 focus:outline-none"
                  aria-label="Public view link"
                />
                <button
                  onClick={copyLink}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors',
                    copied ? 'bg-emerald-500 text-white' : 'bg-flash-400 hover:bg-flash-500 text-midnight-900'
                  )}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLink('POST')}
                  disabled={linkBusy}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-midnight-600 hover:text-midnight-900 transition-colors disabled:opacity-50"
                  title="Old links stop working"
                >
                  <RefreshCw size={13} className={linkBusy ? 'animate-spin' : ''} /> New link
                </button>
                <span className="text-midnight-300">·</span>
                <button
                  onClick={() => setLink('DELETE')}
                  disabled={linkBusy}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  Turn off link sharing
                </button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setLink('POST')} loading={linkBusy} variant="outline" leftIcon={Link2}>
              Create view link
            </Button>
          )}
        </Card>

        {/* Caretaker requests */}
        {requests.length > 0 && (
          <Card padding="lg" className="mb-6 border-2 border-flash-300">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-1">
              <HeartHandshake size={18} className="text-flash-500" /> Caretaker requests
            </h2>
            <p className="text-sm text-midnight-500 mb-3">
              People who saw {pet?.name}&apos;s page and want to help. They get no access until you approve.
            </p>
            <div className="divide-y divide-midnight-100">
              {requests.map((share) => {
                const displayName = [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ');
                return (
                  <div key={share.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-10 h-10 rounded-full bg-flash-100 text-flash-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initialsOf(share)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-midnight-900 text-sm truncate">{displayName || share.email}</p>
                      <p className="text-xs text-midnight-500 truncate">
                        {displayName ? share.email : 'Asked to join as a caretaker'}
                      </p>
                    </div>
                    <button
                      onClick={() => approve(share)}
                      disabled={busyId === share.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      Approve
                    </button>
                    <button
                      onClick={() => remove(share)}
                      disabled={busyId === share.id}
                      className="px-3 py-2 rounded-xl border border-midnight-200 text-midnight-500 hover:text-red-600 hover:border-red-300 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Care team */}
        <Card padding="lg">
          <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-1">
            <Users size={18} className="text-midnight-400" /> {pet?.name}&apos;s care team
          </h2>
          {active.length === 0 && pending.length === 0 ? (
            <p className="text-sm text-midnight-500 py-4">
              Just you so far. Invite someone above to share the load.
            </p>
          ) : (
            <div className="divide-y divide-midnight-100 mt-3">
              {[...active, ...pending].map((share) => (
                <PersonRow
                  key={share.id}
                  share={share}
                  busy={busyId === share.id}
                  onRoleChange={changeRole}
                  onRemove={remove}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
