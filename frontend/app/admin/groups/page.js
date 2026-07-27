'use client';

/**
 * Admin Community Groups Page
 *
 * The full CommunityGroup directory: every group the share_targets cascade
 * discovered, with kind, area, status, discovery dates, and usage. Admins can
 * age a link out (Mark stale), revive it, block it permanently (Remove), or
 * hard-delete junk rows. Listing a group is not an endorsement.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/Toast';
import { US_STATES, normalizeState } from '@/app/lib/usStates';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Ban,
  Undo2,
  Clock,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'STALE', label: 'Stale' },
  { value: 'REMOVED', label: 'Removed' },
];

const KIND_LABELS = { FACEBOOK_GROUP: 'Facebook group' };

const STATUS_STYLES = {
  ACTIVE: 'bg-green-100 text-green-800',
  STALE: 'bg-amber-100 text-amber-800',
  REMOVED: 'bg-red-100 text-red-800',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminGroupsPage() {
  const toast = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [filters, setFilters] = useState({ search: '', state: '', status: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 25;

  const [sweep, setSweep] = useState({ city: '', state: '', lat: null, lng: null });
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [searchConfigured, setSearchConfigured] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/groups');
    } else if (session && session.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.search) params.set('search', filters.search);
      if (filters.state) params.set('state', filters.state);
      if (filters.status) params.set('status', filters.status);

      const response = await fetch(`/api/admin/groups?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch groups');

      setGroups(data.groups || []);
      setStats(data.stats || null);
      setSearchConfigured(data.searchConfigured !== false);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / limit)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') fetchGroups();
  }, [session, fetchGroups]);

  const setStatus = async (group, nextStatus) => {
    setBusyId(group.id);
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      toast.success(`${group.name}: ${nextStatus.toLowerCase()}`);
      fetchGroups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const runSweep = async (e) => {
    e.preventDefault();
    if (!sweep.city.trim() || sweeping) return;
    setSweeping(true);
    setSweepResult(null);
    try {
      const response = await fetch('/api/admin/groups/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: sweep.city.trim(), state: sweep.state.trim(), lat: sweep.lat, lng: sweep.lng }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sweep failed');
      setSweepResult(data);
      // Jump the table to the area we just swept so the new rows are visible.
      setPage(1);
      setFilters({ search: sweep.city.trim(), state: '', status: '' });
      toast.success(
        data.groups.length > 0
          ? `Found ${data.groups.length} group${data.groups.length === 1 ? '' : 's'} for ${data.city}`
          : `No matching groups found for ${data.city} (${data.candidates} candidates checked)`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSweeping(false);
    }
  };

  const deleteGroup = async (group) => {
    if (!window.confirm(`Delete "${group.name}" from the directory? A future sweep may re-add it; use Remove to block it instead.`)) return;
    setBusyId(group.id);
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [group.id] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Deleted');
      fetchGroups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (status === 'loading' || session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-7 h-7 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Community Groups</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Local groups discovered automatically from public search results and suggested to owners as places
          to post their case.
        </p>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            These groups are independent communities found in public search results. Listing one here is not an
            endorsement, and we have no affiliation with any of them. Use Remove to block anything that should
            never be suggested to owners.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Stale" value={stats.stale} />
            <StatCard label="Removed" value={stats.removed} />
            <StatCard label="Areas covered" value={stats.areas} />
            <StatCard label="Times served" value={stats.timesServed} />
          </div>
        )}

        <form onSubmit={runSweep} className="bg-white rounded-lg shadow p-4 mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-1">Run a search for a city</p>
          <p className="text-xs text-gray-500 mb-3">
            Runs the same discovery the cascade uses (web search for public Facebook groups, then AI ranking)
            and saves the results, so the area is ready before anyone reports there. Also refreshes an area
            without waiting out the 30-day window.
          </p>
          {!searchConfigured && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Group search runs through Claude web search and needs <code className="font-mono">ANTHROPIC_API_KEY</code> set
                on the server (the same key that writes flyer copy). Everything else on this page still works.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <CityAutocomplete
              value={sweep.city}
              disabled={!searchConfigured}
              onChange={(city) => setSweep((s) => ({ ...s, city, lat: null, lng: null }))}
              onPick={(o) => setSweep({ city: o.city, state: o.state, lat: o.lat, lng: o.lng })}
            />
            <select
              value={sweep.state}
              disabled={!searchConfigured}
              onChange={(e) => setSweep((s) => ({ ...s, state: e.target.value }))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">State</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!searchConfigured || !sweep.city.trim() || sweeping}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
            >
              {sweeping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {sweeping ? 'Searching' : 'Search now'}
            </button>
          </div>
          {sweepResult && (
            <p className="text-xs text-gray-500 mt-2">
              {sweepResult.groups.length > 0
                ? `Saved ${sweepResult.groups.length} group${sweepResult.groups.length === 1 ? '' : 's'} for ${sweepResult.city}${sweepResult.state ? `, ${sweepResult.state}` : ''} (from ${sweepResult.candidates} candidates). The table below is filtered to show them.`
                : `Nothing worth keeping for ${sweepResult.city}: ${sweepResult.candidates} candidates checked, none passed the lost-pet relevance filter.`}
            </p>
          )}
        </form>

        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, slug, city, or coverage"
              value={filters.search}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, search: e.target.value }));
              }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            placeholder="State"
            value={filters.state}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, state: e.target.value }));
            }}
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filters.status}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, status: e.target.value }));
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Group</Th>
                  <Th>Kind</Th>
                  <Th>Area</Th>
                  <Th>Covers</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
                  <Th>Last confirmed</Th>
                  <Th>Served</Th>
                  <Th>Source</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin inline" />
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                      No groups yet. The directory fills itself as owners in new areas report pets.
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className={g.status === 'REMOVED' ? 'bg-red-50/40' : ''}>
                      <td className="px-4 py-3">
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {g.name}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <div className="text-xs text-gray-400">/groups/{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {KIND_LABELS[g.kind] || g.kind}
                        <div className="text-xs text-gray-400">
                          {g.category === 'COMMUNITY' ? 'Community' : 'Lost pets'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {g.city}
                        {g.state ? `, ${g.state}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[220px]">
                        <div className="truncate" title={g.coverage || ''}>{g.coverage || '-'}</div>
                        <CityChips citiesJson={g.cities} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[g.status] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {g.status}
                        </span>
                        {g.status !== 'ACTIVE' && g.staleAt && (
                          <div className="text-xs text-gray-400 mt-0.5">since {fmtDate(g.staleAt)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(g.fetchedAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{g.timesServed}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{g.source}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {g.status === 'ACTIVE' && (
                            <ActionButton
                              title="Mark stale (a future sweep can revive it)"
                              onClick={() => setStatus(g, 'STALE')}
                              disabled={busyId === g.id}
                            >
                              <Clock className="w-4 h-4" />
                            </ActionButton>
                          )}
                          {g.status !== 'ACTIVE' && (
                            <ActionButton
                              title="Reactivate"
                              onClick={() => setStatus(g, 'ACTIVE')}
                              disabled={busyId === g.id}
                            >
                              <Undo2 className="w-4 h-4" />
                            </ActionButton>
                          )}
                          {g.status !== 'REMOVED' && (
                            <ActionButton
                              title="Remove (block permanently, sweeps never re-add it)"
                              onClick={() => setStatus(g, 'REMOVED')}
                              disabled={busyId === g.id}
                              danger
                            >
                              <Ban className="w-4 h-4" />
                            </ActionButton>
                          )}
                          <ActionButton
                            title="Delete row (a future sweep may re-add it)"
                            onClick={() => deleteGroup(g)}
                            disabled={busyId === g.id}
                            danger
                          >
                            <Trash2 className="w-4 h-4" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** City picker backed by the same Nominatim proxy the report flow's location
 *  search uses: type a few letters, pick a real "City, ST", and the state
 *  dropdown fills itself. Free text still works for tiny places the geocoder
 *  misses. */
function CityAutocomplete({ value, onChange, onPick, disabled }) {
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  const handleInput = (q) => {
    onChange(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: '6',
          addressdetails: '1',
          countrycodes: 'us',
        });
        const res = await fetch(`/api/geocode?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const seen = new Set();
        const opts = (Array.isArray(data) ? data : [])
          .map((r) => {
            const a = r.address || {};
            const city = a.city || a.town || a.village || a.municipality || '';
            const state = normalizeState(a.state || '');
            const lat = parseFloat(r.lat);
            const lng = parseFloat(r.lon);
            return city ? { city, state, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null } : null;
          })
          .filter(Boolean)
          .filter((o) => {
            const k = `${o.city}|${o.state}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        setOptions(opts);
        setOpen(opts.length > 0);
      } catch {
        // Geocoder hiccup: the field still works as free text.
      }
    }, 250);
  };

  return (
    <div className="relative flex-1 min-w-[220px]">
      <input
        type="text"
        placeholder="City (required)"
        value={value}
        disabled={disabled}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(options.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {options.map((o) => (
            <li key={`${o.city}|${o.state}`}>
              <button
                type="button"
                onMouseDown={() => {
                  onPick(o);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50"
              >
                {o.city}
                {o.state ? `, ${o.state}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The towns a group serves, from its JSON cities column. */
function CityChips({ citiesJson }) {
  let cities = [];
  try {
    const parsed = JSON.parse(citiesJson || '[]');
    if (Array.isArray(parsed)) cities = parsed.filter((c) => typeof c === 'string');
  } catch {
    cities = [];
  }
  if (cities.length === 0) return null;
  return (
    <div className="text-xs text-gray-400 truncate" title={cities.join(', ')}>
      {cities.join(', ')}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </th>
  );
}

function ActionButton({ title, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
