'use client';

/**
 * Care team - the PEOPLE room (docs/PRODUCT_IA_PLAN.md §3)
 *
 * Route: /pets/[id]/share
 * The one home of the "care team" noun: pending caretaker requests
 * first (they're waiting on you), then the team, then the invite form
 * and the public view link. Owners manage; caregivers see a friendly
 * read-only note instead of an error.
 *
 * Presentation is the Paper Passport: the roster is a ruled page of
 * the book, requests arrive as a red-edged note, and invites go out
 * in mono ink.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
  UserPlus, X, Loader2, Mail,
  HeartHandshake, Eye, Trash2, Check, Link2, Copy, RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { cn } from '@/components/ui';
import { usePet } from '@/app/components/care/PetProvider';
import {
  Sheet, SectionInk, RuledList, RuledRow, StampText,
} from '@/app/components/care/paper/Paper';

const ROLE_OPTIONS = [
  {
    value: 'CAREGIVER',
    label: 'Caregiver',
    icon: HeartHandshake,
    description: 'writes in doses and keeps the record up to date',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    icon: Eye,
    description: 'reads the book and the schedule, nothing more',
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
    <RuledRow>
      <span
        className={cn(
          'w-9 h-9 border rounded-[3px] bg-paper-50 flex items-center justify-center font-stamp text-[11px] tracking-[0.06em] shrink-0',
          pending ? 'border-pen-300 text-pen-300' : 'border-pen-400 text-pen-600'
        )}
        style={{ transform: 'rotate(-2deg)' }}
      >
        {initialsOf(share)}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-pen-900 truncate leading-tight">
          {displayName || share.email}
        </p>
        <p className="font-diary italic text-[12px] text-pen-400 truncate mt-0.5">
          {displayName ? share.email : pending ? 'waiting for them to accept' : ''}
          {displayName && pending && ' · invite pending'}
        </p>
      </div>

      {pending && <StampText tone="ink" rotate={4} size="sm">Pending</StampText>}

      <select
        value={share.role}
        onChange={(e) => onRoleChange(share, e.target.value)}
        disabled={busy}
        aria-label={`Role for ${share.email}`}
        className="font-stamp text-[10px] uppercase tracking-[0.08em] rounded-[4px] border border-pen-300 bg-paper-50 px-2 py-1.5 text-pen-600 focus:outline-none focus:border-stampred disabled:opacity-50"
      >
        <option value="CAREGIVER">Caregiver</option>
        <option value="VIEWER">Viewer</option>
      </select>

      <button
        onClick={() => onRemove(share)}
        disabled={busy}
        className="p-2 text-pen-400 hover:text-stampred transition-colors disabled:opacity-50"
        title={pending ? 'Cancel invite' : 'Remove access'}
        aria-label={`Remove ${share.email}`}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </RuledRow>
  );
}

export default function PetSharePage() {
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
      // Non-owners can't read the roster; the page shows them a
      // friendly note below instead of an error banner.
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

  // Caregivers and viewers get a warm note, not a wall: the roster is
  // the owner's to manage.
  if (access && access !== 'OWNER') {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-2xl mx-auto">
          <Sheet className="mt-6 text-center py-9">
            <StampText tone="green" rotate={-4}>On the team</StampText>
            <h2 className="font-diary italic text-[21px] text-pen-900 mt-4 mb-1.5">
              You&apos;re on {petName}&apos;s care team
            </h2>
            <p className="font-diary italic text-[13.5px] text-pen-400 max-w-md mx-auto">
              {access === 'CAREGIVER'
                ? `you can write doses into Today and keep the Health Book up to date. only the owner decides who holds the book.`
                : `you can read ${petName}'s book and the schedule. only the owner decides who holds the book.`}
            </p>
          </Sheet>
        </div>
      </div>
    );
  }

  const active = shares.filter((s) => s.status === 'ACTIVE');
  const pending = shares.filter((s) => s.status === 'PENDING');
  const requests = shares.filter((s) => s.status === 'REQUESTED');

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark px-4 py-3 my-4 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-stampred hover:text-stampred-dark"><X size={18} /></button>
          </div>
        )}
        {success && (
          <div className="border-l-[3px] border-stampgreen bg-stampgreen-wash/70 text-stampgreen px-4 py-3 my-4 text-sm flex items-center justify-between">
            <span className="inline-flex items-center gap-2"><Check size={16} /> {success}</span>
            <button onClick={() => setSuccess(null)} className="text-stampgreen hover:opacity-70"><X size={18} /></button>
          </div>
        )}

        {/* Caretaker requests: someone is waiting on you — always first */}
        {requests.length > 0 && (
          <Sheet className="mt-6 mb-6 border-l-[3px] border-l-stampred">
            <SectionInk>caretaker requests</SectionInk>
            <p className="font-diary italic text-[12.5px] text-pen-400 -mt-1 mb-1">
              people who saw {petName}&apos;s page and want to help. they get no access until you approve.
            </p>
            <RuledList>
              {requests.map((share) => {
                const displayName = [share.user?.firstName, share.user?.lastName].filter(Boolean).join(' ');
                return (
                  <RuledRow key={share.id}>
                    <span
                      className="w-9 h-9 border border-pen-400 rounded-[3px] bg-paper-50 flex items-center justify-center font-stamp text-[11px] tracking-[0.06em] text-pen-600 shrink-0"
                      style={{ transform: 'rotate(2deg)' }}
                    >
                      {initialsOf(share)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[14px] text-pen-900 truncate leading-tight">{displayName || share.email}</p>
                      <p className="font-diary italic text-[12px] text-pen-400 truncate mt-0.5">
                        {displayName ? share.email : 'asked to join as a caretaker'}
                      </p>
                    </div>
                    <button
                      onClick={() => approve(share)}
                      disabled={busyId === share.id}
                      className="inline-flex items-center gap-1.5 font-stamp text-[10px] uppercase tracking-[0.12em] bg-stampgreen text-paper-50 rounded-[4px] px-3.5 py-2 hover:opacity-90 transition-colors disabled:opacity-50"
                    >
                      {busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      Approve
                    </button>
                    <button
                      onClick={() => remove(share)}
                      disabled={busyId === share.id}
                      className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 px-2 py-2 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </RuledRow>
                );
              })}
            </RuledList>
          </Sheet>
        )}

        {/* The team itself */}
        <Sheet className={cn('mb-6', requests.length === 0 && 'mt-6')}>
          <SectionInk>{petName}&rsquo;s care team</SectionInk>
          {active.length === 0 && pending.length === 0 ? (
            <p className="font-diary italic text-[13.5px] text-pen-400 py-3">
              just you so far. invite someone below to share the load.
            </p>
          ) : (
            <RuledList>
              {[...active, ...pending].map((share) => (
                <PersonRow
                  key={share.id}
                  share={share}
                  busy={busyId === share.id}
                  onRoleChange={changeRole}
                  onRemove={remove}
                />
              ))}
            </RuledList>
          )}
        </Sheet>

        {/* Invite form */}
        <Sheet className="mb-6">
          <SectionInk>invite someone</SectionInk>
          <form onSubmit={invite} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pen-300" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their@email.com"
                className="w-full rounded-[5px] border border-pen-300 bg-paper-50 pl-10 pr-3.5 py-2.5 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    'text-left rounded-[5px] border-[1.5px] p-3.5 transition-colors',
                    role === opt.value
                      ? 'border-stampred bg-stampred-wash'
                      : 'border-paper-400 bg-paper-50 hover:border-pen-300'
                  )}
                >
                  <span className="flex items-center gap-2 font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-900 mb-1">
                    <opt.icon size={14} className={role === opt.value ? 'text-stampred' : 'text-pen-400'} />
                    {opt.label}
                  </span>
                  <span className="font-diary italic text-[12px] text-pen-400">{opt.description}</span>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="w-full inline-flex items-center justify-center gap-2 font-stamp text-[11px] uppercase tracking-[0.12em] bg-pen-900 text-paper-50 rounded-[5px] px-4 py-3 hover:bg-pen-600 transition-colors disabled:opacity-50"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Send invite
            </button>
            <p className="font-diary italic text-[12px] text-pen-400 text-center">
              no account with that email yet? they&apos;ll get access as soon as they sign up with it and accept.
            </p>
          </form>
        </Sheet>

        {/* View link */}
        <Sheet className="mb-6">
          <SectionInk>the view link</SectionInk>
          <p className="font-diary italic text-[12.5px] text-pen-400 -mt-1 mb-4">
            anyone with the link can read {petName}&apos;s care page, no account needed.
            they can ask to join as a caretaker; you approve every request here.
          </p>

          {linkUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={absoluteLink || ''}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 font-stamp text-[11px] rounded-[5px] border border-paper-400 bg-paper-200 px-3.5 py-2.5 text-pen-600 focus:outline-none"
                  aria-label="Public view link"
                />
                <button
                  onClick={copyLink}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 font-stamp text-[10px] uppercase tracking-[0.12em] rounded-[4px] px-3.5 py-2.5 transition-colors',
                    copied
                      ? 'border-[1.5px] border-stampgreen bg-stampgreen text-paper-50'
                      : 'border-[1.5px] border-pen-900 text-pen-900 hover:bg-pen-900 hover:text-paper-50'
                  )}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLink('POST')}
                  disabled={linkBusy}
                  className="inline-flex items-center gap-1.5 font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 transition-colors disabled:opacity-50"
                  title="Old links stop working"
                >
                  <RefreshCw size={12} className={linkBusy ? 'animate-spin' : ''} /> New link
                </button>
                <span className="text-pen-300">·</span>
                <button
                  onClick={() => setLink('DELETE')}
                  disabled={linkBusy}
                  className="font-stamp text-[10px] uppercase tracking-[0.12em] text-stampred hover:text-stampred-dark transition-colors disabled:opacity-50"
                >
                  Turn off link sharing
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLink('POST')}
              disabled={linkBusy}
              className="inline-flex items-center gap-1.5 font-stamp text-[10.5px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-3.5 py-2.5 hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors disabled:opacity-50"
            >
              {linkBusy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Create view link
            </button>
          )}
        </Sheet>

      </div>
    </div>
  );
}
