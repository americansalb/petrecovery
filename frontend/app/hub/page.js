'use client';

/**
 * Rescue Hub Landing Page
 *
 * Community forum for pet rescuers to connect, learn, and coordinate.
 * Categories organized into logical sections.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare, Users, Heart, Truck, BookOpen, Trophy,
  AlertTriangle, MessageCircle, ChevronRight, Plus,
  Loader2, Sparkles, ArrowRight, Search, Building2
} from 'lucide-react';

// Category sections for organization
const CATEGORY_SECTIONS = {
  'Need Help': {
    description: 'Get immediate assistance',
    color: 'from-red-500 to-orange-500',
    categories: ['lost-pet-support', 'found-pet-help', 'urgent'],
  },
  'Rescue Network': {
    description: 'Coordinate with other rescuers',
    color: 'from-amber-500 to-yellow-500',
    categories: ['transport', 'foster', 'shelter-talk'],
  },
  'Learn & Grow': {
    description: 'Resources and training',
    color: 'from-blue-500 to-cyan-500',
    categories: ['training'],
  },
  'Community': {
    description: 'Connect with others',
    color: 'from-green-500 to-emerald-500',
    categories: ['welcome', 'success-stories', 'general'],
  },
};

// Map category slugs to icons
const CATEGORY_ICONS = {
  'welcome': Users,
  'lost-pet-support': Heart,
  'found-pet-help': Search,
  'transport': Truck,
  'foster': Heart,
  'shelter-talk': Building2,
  'training': BookOpen,
  'success-stories': Trophy,
  'urgent': AlertTriangle,
  'general': MessageCircle,
};

export default function HubPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [recentThreads, setRecentThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/hub/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, threadsRes] = await Promise.all([
        fetch('/api/hub/categories'),
        fetch('/api/hub/threads?limit=5&sort=recent'),
      ]);

      const categoriesData = await categoriesRes.json();
      const threadsData = await threadsRes.json();

      if (categoriesData.success) {
        setCategories(categoriesData.categories || []);
      }
      if (threadsData.success) {
        setRecentThreads(threadsData.threads || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoriesBySection = (sectionCategories) => {
    return categories.filter(cat => sectionCategories.includes(cat.slug));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading Rescue Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8" />
            <span className="text-indigo-200 font-medium">Community</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Rescue Hub
          </h1>
          <p className="text-indigo-100 text-lg max-w-2xl mb-6">
            A community space for pet rescuers to connect, learn, and coordinate.
            Whether you've lost a pet, found a stray, or want to help reunite families —
            you belong here.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-6 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discussions..."
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-white text-indigo-600 rounded-md font-medium text-sm hover:bg-indigo-50 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-4">
            {authStatus === 'authenticated' ? (
              <Link
                href="/hub/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
              >
                <Plus size={20} />
                Start a Discussion
              </Link>
            ) : (
              <Link
                href="/login?redirect=/hub"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
              >
                Join the Community
                <ArrowRight size={20} />
              </Link>
            )}
            <Link
              href="/hub/c/welcome"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-400 transition-colors"
            >
              <Users size={20} />
              Introduce Yourself
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 -mt-8">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {categories.reduce((sum, c) => sum + (c.threadCount || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">Discussions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {categories.length}
            </div>
            <div className="text-sm text-gray-500">Categories</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {categories.find(c => c.slug === 'transport')?.threadCount || 0}
            </div>
            <div className="text-sm text-gray-500">Transports</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-pink-600">
              {categories.find(c => c.slug === 'success-stories')?.threadCount || 0}
            </div>
            <div className="text-sm text-gray-500">Reunions</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/hub/new?template=lost-pet"
              className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
            >
              <span className="text-2xl">🚨</span>
              <div>
                <div className="font-medium text-red-700 text-sm">Report Lost Pet</div>
              </div>
            </Link>
            <Link
              href="/hub/new?template=found-pet"
              className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
            >
              <span className="text-2xl">🔍</span>
              <div>
                <div className="font-medium text-blue-700 text-sm">Report Found Pet</div>
              </div>
            </Link>
            <Link
              href="/hub/new?template=transport"
              className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-100"
            >
              <span className="text-2xl">🚗</span>
              <div>
                <div className="font-medium text-amber-700 text-sm">Request Transport</div>
              </div>
            </Link>
            <Link
              href="/hub/new?template=success-story"
              className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-100"
            >
              <span className="text-2xl">🎉</span>
              <div>
                <div className="font-medium text-green-700 text-sm">Share Success</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Categories by Section */}
          <div className="lg:col-span-2 space-y-8">
            {Object.entries(CATEGORY_SECTIONS).map(([sectionName, section]) => {
              const sectionCategories = getCategoriesBySection(section.categories);
              if (sectionCategories.length === 0) return null;

              return (
                <div key={sectionName}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${section.color}`} />
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{sectionName}</h2>
                      <p className="text-sm text-gray-500">{section.description}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sectionCategories.map((category) => {
                      const IconComponent = CATEGORY_ICONS[category.slug] || MessageSquare;
                      return (
                        <Link
                          key={category.id}
                          href={`/hub/c/${category.slug}`}
                          className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            >
                              {category.icon ? (
                                <span className="text-xl">{category.icon}</span>
                              ) : (
                                <IconComponent size={20} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                                {category.name}
                              </h3>
                              <p className="text-sm text-gray-500 line-clamp-2">
                                {category.description}
                              </p>
                              <div className="mt-2 text-xs text-gray-400">
                                {category.threadCount || 0} threads
                              </div>
                            </div>
                            <ChevronRight
                              size={20}
                              className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0"
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div>
            {/* Recent Activity */}
            <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Discussions</h2>
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {recentThreads.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No discussions yet</p>
                  <p className="text-sm">Be the first to start one!</p>
                </div>
              ) : (
                recentThreads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/hub/thread/${thread.slug}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 text-sm"
                        style={{ backgroundColor: thread.category?.color || '#6366f1' }}
                      >
                        {thread.category?.icon || '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-800 line-clamp-2 text-sm">
                          {thread.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <span>{thread.author?.firstName || 'Unknown'}</span>
                          <span>•</span>
                          <span>{formatTime(thread.lastActivityAt)}</span>
                          {thread.replyCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{thread.replyCount} replies</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
              <Link
                href="/hub/c/general"
                className="block p-4 text-center text-indigo-600 hover:bg-indigo-50 font-medium text-sm"
              >
                View All Discussions
              </Link>
            </div>

            {/* Urgent Alerts */}
            <div className="mt-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Urgent Alerts
              </h2>
              <Link
                href="/hub/c/urgent"
                className="block bg-red-50 border border-red-200 rounded-xl p-4 hover:bg-red-100 transition-colors"
              >
                <p className="text-red-700 text-sm">
                  Time-sensitive situations needing immediate attention.
                  Check here for emergencies and urgent transport needs.
                </p>
                <div className="mt-2 text-red-600 font-medium text-sm flex items-center gap-1">
                  View Urgent Posts
                  <ChevronRight size={16} />
                </div>
              </Link>
            </div>

            {/* Guidelines */}
            <div className="mt-6 bg-indigo-50 rounded-xl p-5">
              <h3 className="font-semibold text-indigo-800 mb-3">Community Guidelines</h3>
              <ul className="space-y-2 text-sm text-indigo-700">
                <li>• Be kind and supportive</li>
                <li>• No spam or self-promotion</li>
                <li>• Respect privacy</li>
                <li>• Report, don't engage trolls</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
