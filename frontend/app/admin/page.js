'use client';

/**
 * Phase 10: Admin Dashboard
 *
 * Main admin dashboard with quick access to all admin features.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin');
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchQuickStats();
    }
  }, [session]);

  const fetchQuickStats = async () => {
    try {
      const response = await fetch('/api/admin/analytics?section=overview&days=7');
      const data = await response.json();
      if (response.ok) {
        setStats(data.overview);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || (session?.user?.role === 'ADMIN' && loading)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {session.user.firstName || session.user.email}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <QuickStatCard
              title="Active Missions"
              value={stats.activeMissions}
              change={`+${stats.recentMissions} this week`}
              positive
            />
            <QuickStatCard
              title="Reunited (7 days)"
              value={stats.recentReunions}
              change={`${stats.resolutionRate}% resolution rate`}
              positive
            />
            <QuickStatCard
              title="Total Users"
              value={stats.totalUsers}
              change={`${stats.activeUsers} active`}
            />
            <QuickStatCard
              title="Rescue Squads"
              value={stats.totalSquads}
              change="Active squads"
            />
          </div>
        )}

        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AdminCard
            title="Analytics"
            description="View detailed analytics, charts, and export reports"
            href="/admin/analytics"
            icon="📊"
          />
          <AdminCard
            title="Users"
            description="Manage users, roles, and permissions"
            href="/admin/users"
            icon="👥"
          />
          <AdminCard
            title="Cases"
            description="Moderate cases, review reports, and manage status"
            href="/admin/missions"
            icon="📋"
          />
          <AdminCard
            title="Rescue Squads"
            description="Manage squads, verify organizations, and review activity"
            href="/admin/rescue-squads"
            icon="🛡️"
          />
          <AdminCard
            title="Divisions"
            description="Manage geographic divisions and territories"
            href="/admin/divisions"
            icon="📍"
          />
          <AdminCard
            title="Shelters"
            description="Manage shelter integrations and API connections"
            href="/admin/shelters"
            icon="🏠"
          />
          <AdminCard
            title="Notifications"
            description="Send announcements and manage notification templates"
            href="/admin/notifications"
            icon="🔔"
          />
          <AdminCard
            title="Reports"
            description="Review flagged content and user reports"
            href="/admin/reports"
            icon="🚩"
          />
          <AdminCard
            title="Settings"
            description="Configure site settings and feature flags"
            href="/admin/settings"
            icon="⚙️"
          />
          <AdminCard
            title="Audit Log"
            description="View system activity and admin actions"
            href="/admin/audit"
            icon="📜"
          />
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <ActivityItem
              icon="📋"
              text="New case reported: Missing golden retriever in Los Angeles"
              time="5 minutes ago"
            />
            <ActivityItem
              icon="👤"
              text="New user registered: john.doe@example.com"
              time="15 minutes ago"
            />
            <ActivityItem
              icon="🎉"
              text="Pet reunited: Bella the cat was found and returned to owner"
              time="1 hour ago"
            />
            <ActivityItem
              icon="🦮"
              text="New rescue squad created: LA Pet Rescue Team"
              time="2 hours ago"
            />
            <ActivityItem
              icon="🔔"
              text="Sighting reported for case #12345"
              time="3 hours ago"
            />
          </div>
          <Link
            href="/admin/audit"
            className="block mt-4 text-sm text-blue-600 hover:underline"
          >
            View all activity →
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ title, value, change, positive }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value.toLocaleString()}</p>
      <p className={`text-sm mt-1 ${positive ? 'text-green-600' : 'text-gray-500'}`}>
        {change}
      </p>
    </div>
  );
}

function AdminCard({ title, description, href, icon }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ icon, text, time }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-gray-900">{text}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
    </div>
  );
}
