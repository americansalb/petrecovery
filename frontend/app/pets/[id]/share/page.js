'use client';

/**
 * People tab (direction D): who can see and do what. Join requests come
 * first (someone is waiting on you), then the team, the invite form, and
 * the public view link. Owners manage; caregivers and viewers get a short
 * note instead of an error.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { cn } from '@/components/ui';
import { usePet } from '@/app/components/care/PetProvider';
import { Card, Overline } from '@/app/components/care/kit/Tile';

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
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}/share`);
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

  useEffect(() => { if (status === 'authenticated' && petId) fetchShares(); }, [status, petId, fetchShares]);

  useEffect(() => {
    if (status !== 'authenticated' || !petId) return;
    fetch(`/api/pets/${petId}/share-link`).then((r) => (r.ok ? r.json() : null)).then((data) => setLinkUrl(data?.url || null)).catch(() => {});
  }, [status, petId]);

  const absoluteLink = linkUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${linkUrl}` : null;

  const setLink = async (method) => {
    setLinkBusy(true); setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/share-link`, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update the link');
      setLinkUrl(data.url || null); setCopied(false);
    } catch (err) { setError(err.message); } finally { setLinkBusy(false); }
  };

  const copyLink = async () => {
    if (!absoluteLink) return;
    try { await navigator.clipboard.writeText(absoluteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* unavailable */ }
  };

  const approve = async (share) => {
    setBusyId(share.id); setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setShares((prev) => prev.map((s) => (s.id === share.id ? data.share : s)));
      setSuccess(data.message);
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setShares((prev) => [...prev, data.share]); setSuccess(data.message); setEmail('');
    } catch (err) { setError(err.message); } finally { setInviting(false); }
  };

  const changeRole = async (share, newRole) => {
    if (newRole === share.role) return;
    setBusyId(share.id); setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setShares((prev) => prev.map((s) => (s.id === share.id ? data.share : s)));
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  const remove = async (share) => {
    setBusyId(share.id); setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/shares/${share.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  if (status === 'loading' || loading) return <div className="px-4 py-20 flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  if (status === 'unauthenticated') return null;

  const petName = pet?.name || ctxPet?.name || 'this pet';
  const chip = (on) => cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', on ? 'bg-care-teal text-white border-care-teal' : 'border-care-line text-care-sub hover:border-care-ink');
  const input = 'w-full rounded-xl border border-care-line px-3.5 py-2.5 text-care-base text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal';

  if (access && access !== 'OWNER') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
        <h1 className="text-care-2xl font-semibold tracking-tight text-care-ink mb-2">People</h1>
        <p className="text-care-base text-care-ink">You help care for {petName}.</p>
        <p className="text-care-base text-care-sub mt-1">
          {access === 'CAREGIVER' ? 'You can log doses on Today and keep the record up to date. Only the owner manages who has access.' : `You can read ${petName}'s record and schedule. Only the owner manages who has access.`}
        </p>
      </div>
    );
  }

  const active = shares.filter((s) => s.status === 'ACTIVE');
  const pending = shares.filter((s) => s.status === 'PENDING');
  const requests = shares.filter((s) => s.status === 'REQUESTED');

  const avatar = (share) => (
    <span className="w-9 h-9 rounded-full shrink-0 bg-care-tealWash text-care-teal flex items-center justify-center text-care-sm font-semibold">
      {displayNameOf(share).charAt(0).toUpperCase()}
    </span>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <h1 className="text-care-2xl font-semibold tracking-tight text-care-ink mb-5">People</h1>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 text-red-700 px-4 py-3 mb-4 text-sm">
          <span>{error}</span><button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-care-tealWash text-care-teal px-4 py-3 mb-4 text-sm">
          <span>{success}</span><button onClick={() => setSuccess(null)} className="text-care-teal hover:text-care-tealDark" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {requests.length > 0 && (
        <section className="mb-6">
          <Overline className="mb-2.5">Requests to join</Overline>
          <Card className="overflow-hidden">
            {requests.map((share, i) => (
              <div key={share.id} className={cn('flex items-center gap-3 px-5 py-3.5', i > 0 && 'border-t border-care-lineSoft')}>
                {avatar(share)}
                <div className="flex-1 min-w-0">
                  <p className="text-care-base font-semibold text-care-ink truncate">{displayNameOf(share)}</p>
                  <p className="text-care-sm text-care-sub truncate">Asked to join as a caregiver</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => remove(share)} disabled={busyId === share.id} className="text-care-sm font-medium text-care-sub hover:text-care-ink transition-colors disabled:opacity-50">Decline</button>
                  <button onClick={() => approve(share)} disabled={busyId === share.id} className="rounded-xl bg-care-teal text-white text-care-sm font-semibold px-4 py-1.5 hover:bg-care-tealDark transition-colors disabled:opacity-50">{busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : 'Approve'}</button>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section className="mb-6">
        <Overline className="mb-2.5">Care team</Overline>
        {active.length === 0 && pending.length === 0 ? (
          <Card className="px-5 py-6"><p className="text-care-base text-care-sub">Just you so far. Invite someone below to share the load.</p></Card>
        ) : (
          <Card className="overflow-hidden">
            {[...active, ...pending].map((share, i) => {
              const isPending = share.status === 'PENDING';
              return (
                <div key={share.id} className={cn('flex items-center gap-3 px-5 py-3.5', i > 0 && 'border-t border-care-lineSoft')}>
                  {avatar(share)}
                  <div className="flex-1 min-w-0">
                    <p className="text-care-base font-semibold text-care-ink truncate">{displayNameOf(share)}</p>
                    <p className="text-care-sm text-care-sub truncate">{share.role === 'CAREGIVER' ? 'Caregiver' : 'Viewer'}{isPending && ', invited'}</p>
                  </div>
                  {/* Inline width:auto beats the unlayered globals `select { width:100% }`
                      (an @layer utility like w-auto can't); without it the select
                      swallows the whole row and hides the member's name on mobile. */}
                  <select value={share.role} onChange={(e) => changeRole(share, e.target.value)} disabled={busyId === share.id} aria-label={`Role for ${share.email}`} style={{ width: 'auto' }} className="shrink-0 rounded-lg border border-care-line px-2.5 py-1.5 text-sm text-care-sub focus:outline-none focus:border-care-teal disabled:opacity-50">
                    <option value="CAREGIVER">Caregiver</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button onClick={() => remove(share)} disabled={busyId === share.id} className="text-care-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 shrink-0" aria-label={`Remove ${share.email}`}>{busyId === share.id ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}</button>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section className="mb-6">
        <Overline className="mb-2.5">Invite someone</Overline>
        <Card className="p-5">
          <form method="post" onSubmit={invite} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" aria-label="Email to invite" className={input} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setRole('CAREGIVER')} className={chip(role === 'CAREGIVER')}>Caregiver</button>
              <button type="button" onClick={() => setRole('VIEWER')} className={chip(role === 'VIEWER')}>Viewer</button>
              <button type="submit" disabled={inviting || !email.trim()} className="ml-auto rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-50">{inviting ? <Loader2 size={14} className="animate-spin" /> : 'Invite'}</button>
            </div>
            <p className="text-care-sm text-care-sub">A caregiver logs doses and keeps the record; a viewer can only read it.</p>
          </form>
        </Card>
      </section>

      <section>
        <Overline className="mb-2.5">View link</Overline>
        <Card className="p-5">
          {linkUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input readOnly value={absoluteLink || ''} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 rounded-xl border border-care-line bg-care-bg px-3.5 py-2.5 text-care-sm text-care-sub focus:outline-none" aria-label="Public view link" />
                <button onClick={copyLink} className="shrink-0 rounded-xl border border-care-line text-sm font-semibold text-care-ink px-4 py-2.5 hover:border-care-ink transition-colors">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setLink('POST')} disabled={linkBusy} className="text-care-sm font-medium text-care-sub hover:text-care-ink transition-colors disabled:opacity-50">New link</button>
                <button onClick={() => setLink('DELETE')} disabled={linkBusy} className="text-care-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50">Turn off</button>
              </div>
              <p className="text-care-sm text-care-sub">Anyone with the link can read {petName}'s page and ask to join. You approve every request here.</p>
            </div>
          ) : (
            <div>
              <button onClick={() => setLink('POST')} disabled={linkBusy} className="rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-50">{linkBusy ? 'Creating...' : 'Create view link'}</button>
              <p className="text-care-sm text-care-sub mt-2">A link any vet or sitter can read without an account.</p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
