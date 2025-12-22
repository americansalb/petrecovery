'use client';

/**
 * Rescue Hub - Community Forum
 *
 * Classic forum layout with sections, thread counts, and online users.
 * Inspired by traditional forums like phpBB and vBulletin.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Users, Search, Plus, Loader2,
  ChevronRight, Clock, User, Activity, BarChart3,
  MessageCircle, Eye, Zap
} from 'lucide-react';

export default function HubPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [online, setOnline] = useState({ membersOnline: 0, guestsOnline: 0, users: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Update online status periodically
  const updateOnlineStatus = useCallback(async () => {
    if (session?.user) {
      await fetch('/api/hub/online', { method: 'POST' }).catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    fetchData();
    updateOnlineStatus();

    // Refresh online status every 5 minutes
    const interval = setInterval(updateOnlineStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [updateOnlineStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, statsRes, onlineRes] = await Promise.all([
        fetch('/api/hub/categories'),
        fetch('/api/hub/stats'),
        fetch('/api/hub/online'),
      ]);

      const [categoriesData, statsData, onlineData] = await Promise.all([
        categoriesRes.json(),
        statsRes.json(),
        onlineRes.json(),
      ]);

      if (categoriesData.success) setCategories(categoriesData.categories || []);
      if (statsData.success) setStats(statsData.stats);
      if (onlineData.success) setOnline(onlineData);
    } catch (err) {
      console.error('Error loading forum:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/hub/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading forum...</p>
        </div>
      </div>
    );
  }

  // Group categories by section
  const sections = [
    {
      name: 'Emergency & Alerts',
      icon: '🚨',
      color: 'bg-red-600',
      slugs: ['urgent', 'lost-pet-support', 'found-pet-help'],
    },
    {
      name: 'Rescue Coordination',
      icon: '🤝',
      color: 'bg-amber-600',
      slugs: ['transport', 'foster', 'shelter-talk'],
    },
    {
      name: 'Community',
      icon: '💬',
      color: 'bg-blue-600',
      slugs: ['welcome', 'success-stories', 'general', 'training'],
    },
  ];

  const getCategoriesForSection = (slugs) => {
    return categories.filter(c => slugs.includes(c.slug));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Forum Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <MessageSquare size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Rescue Hub</h1>
                <p className="text-blue-200 text-sm">Pet Recovery Community Forum</p>
              </div>
            </div>

            {authStatus === 'authenticated' ? (
              <Link
                href="/hub/new"
                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                <Plus size={18} />
                New Thread
              </Link>
            ) : (
              <Link
                href="/login?redirect=/hub"
                className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                <User size={18} />
                Login to Post
              </Link>
            )}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-4 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forums..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:outline-none focus:bg-white/20"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Quick Stats Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-slate-600">
                <Activity size={16} className="text-green-500" />
                <span><strong className="text-slate-800">{online.totalOnline || 0}</strong> Online</span>
                <span className="text-slate-400">({online.membersOnline} members, {online.guestsOnline} guests)</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span><strong>{stats?.totalThreads || 0}</strong> Threads</span>
              <span><strong>{stats?.totalPosts || 0}</strong> Posts</span>
              <span><strong>{stats?.totalMembers || 0}</strong> Members</span>
            </div>
          </div>
        </div>

        {/* Forum Sections */}
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionCategories = getCategoriesForSection(section.slugs);
            if (sectionCategories.length === 0) return null;

            return (
              <div key={section.name} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                {/* Section Header */}
                <div className={`${section.color} px-4 py-2`}>
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <span className="text-lg">{section.icon}</span>
                    {section.name}
                  </h2>
                </div>

                {/* Category Table */}
                <div className="divide-y divide-slate-100">
                  {/* Table Header */}
                  <div className="hidden sm:grid sm:grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <div className="col-span-6">Forum</div>
                    <div className="col-span-2 text-center">Threads</div>
                    <div className="col-span-4">Last Post</div>
                  </div>

                  {/* Category Rows */}
                  {sectionCategories.map((category) => (
                    <div
                      key={category.id}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      <div className="grid sm:grid-cols-12 gap-4 px-4 py-4 items-center">
                        {/* Forum Info */}
                        <div className="sm:col-span-6">
                          <Link href={`/hub/c/${category.slug}`} className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl flex-shrink-0"
                              style={{ backgroundColor: category.color || '#3b82f6' }}
                            >
                              {category.icon || '💬'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                {category.name}
                              </h3>
                              <p className="text-sm text-slate-500 line-clamp-1">
                                {category.description}
                              </p>
                            </div>
                          </Link>
                        </div>

                        {/* Stats */}
                        <div className="sm:col-span-2 flex sm:flex-col items-center sm:items-center gap-4 sm:gap-0">
                          <div className="text-center">
                            <div className="font-semibold text-slate-700">{category.threadCount || 0}</div>
                            <div className="text-xs text-slate-400 sm:hidden">threads</div>
                          </div>
                          <div className="text-center sm:mt-1">
                            <div className="text-sm text-slate-500">{category.postCount || 0} posts</div>
                          </div>
                        </div>

                        {/* Last Post */}
                        <div className="sm:col-span-4">
                          {category.lastPost ? (
                            <Link
                              href={`/hub/thread/${category.lastPost.threadSlug}`}
                              className="block hover:text-blue-600 transition-colors"
                            >
                              <div className="text-sm text-slate-700 line-clamp-1 font-medium">
                                {category.lastPost.threadTitle}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock size={12} />
                                {formatTime(category.lastPost.at)}
                                <span className="text-slate-300">by</span>
                                <span className="text-slate-600">{category.lastPost.by?.firstName || 'Unknown'}</span>
                              </div>
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400 italic">No posts yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Who's Online + Forum Stats */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Who's Online */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-700 px-4 py-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Users size={16} />
                Who's Online
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-slate-600">
                  <strong className="text-slate-800">{online.totalOnline || 0}</strong> users online
                  ({online.membersOnline} members, {online.guestsOnline} guests)
                </span>
              </div>

              {online.users && online.users.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {online.users.slice(0, 20).map((user) => (
                    <Link
                      key={user.id}
                      href={`/hub/u/${user.id}`}
                      className={`text-sm px-2 py-0.5 rounded hover:bg-slate-100 transition-colors ${
                        user.isAdmin ? 'text-red-600 font-medium' :
                        user.isMod ? 'text-purple-600 font-medium' :
                        'text-blue-600'
                      }`}
                    >
                      {user.name}
                    </Link>
                  ))}
                  {online.users.length > 20 && (
                    <span className="text-sm text-slate-400">
                      and {online.users.length - 20} more...
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No members currently online</p>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                <span className="text-red-600">Administrators</span>
                {' • '}
                <span className="text-purple-600">Moderators</span>
                {' • '}
                <span className="text-blue-600">Members</span>
              </div>
            </div>
          </div>

          {/* Forum Statistics */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-700 px-4 py-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <BarChart3 size={16} />
                Forum Statistics
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-800">{stats?.totalThreads || 0}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Threads</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-800">{stats?.totalPosts || 0}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Posts</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-800">{stats?.totalMembers || 0}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Members</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-800">{categories.length}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Forums</div>
                </div>
              </div>

              {stats?.newestMember && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-sm text-slate-600">
                    <span className="text-slate-400">Newest member:</span>{' '}
                    <Link href={`/hub/u/${stats.newestMember.id}`} className="text-blue-600 hover:underline font-medium">
                      {stats.newestMember.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link href="/hub/search" className="text-blue-600 hover:underline flex items-center gap-1">
              <Search size={14} />
              Search Forums
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/hub/c/success-stories" className="text-blue-600 hover:underline flex items-center gap-1">
              <Zap size={14} />
              Success Stories
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/hub/c/welcome" className="text-blue-600 hover:underline flex items-center gap-1">
              <Users size={14} />
              Introduce Yourself
            </Link>
            {authStatus === 'authenticated' && (
              <>
                <span className="text-slate-300">|</span>
                <Link href="/hub/new" className="text-blue-600 hover:underline flex items-center gap-1">
                  <Plus size={14} />
                  New Thread
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
