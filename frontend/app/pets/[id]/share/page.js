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
  HeartHandshake, Eye, Trash2, Check, Users,
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

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/pets/${petId}/medications`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> {pet?.name || 'Back'}
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-midnight-200 overflow-hidden flex items-center justify-center flex-shrink-0">
            {pet?.primaryPhotoUrl ? (
              <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              <PawPrint className="w-6 h-6 text-midnight-400" />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-midnight-900">Share {pet?.name}</h1>
            <p className="text-sm text-midnight-500">
              Family, sitters, anyone helping out. They&apos;ll see {pet?.name}&apos;s meds and can check off doses.
            </p>
          </div>
        </div>

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
