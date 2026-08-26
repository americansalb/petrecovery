'use client';

/**
 * Forum User Profile Page
 *
 * Shows a user's forum activity, badges, and trust level.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  ArrowLeft, User, MapPin, Calendar, Star, Award, Shield,
  MessageSquare, FileText, Heart, ThumbsUp, CheckCircle,
  Building2, Clock, Loader2, Eye
} from 'lucide-react';

const TABS = [
  { id: 'posts', label: 'Replies', icon: MessageSquare },
  { id: 'threads', label: 'Threads', icon: FileText },
  { id: 'reactions', label: 'Reactions Given', icon: Heart },
];

const TRUST_LEVEL_COLORS = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-midnight-100 text-midnight-700',
  2: 'bg-midnight-200 text-midnight-800',
  3: 'bg-midnight-900 text-white',
  4: 'bg-flash-100 text-flash-800',
};

export default function ForumProfilePage({ params }) {
  const { id: userId } = params;
  const { data: session } = useSession();

  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchProfile();
  }, [userId, activeTab, page]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hub/profile/${userId}?tab=${activeTab}&page=${page}`);
      const data = await res.json();

      if (data.success) {
        setProfile(data.profile);
        setActivity(data.activity);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(dateStr);
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-midnight-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Profile not found</h2>
          <Link href="/hub" className="text-midnight-900 hover:text-flash-600 font-medium">
            Return to Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Hub
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-midnight-600 to-midnight-900 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
              {profile.user.firstName?.[0] || '?'}
            </div>

            <div className="flex-1">
              {/* Name and Badges */}
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold text-gray-800">
                  {profile.user.firstName} {profile.user.lastName}
                </h1>
                {profile.user.isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                    <Shield size={12} />
                    Admin
                  </span>
                )}
                {profile.user.isModerator && !profile.user.isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-midnight-900 text-white text-xs rounded-full font-medium">
                    <Shield size={12} />
                    Moderator
                  </span>
                )}
                {profile.isVerifiedShelter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-flash-100 text-flash-800 text-xs rounded-full font-medium">
                    <Building2 size={12} />
                    Verified Shelter
                  </span>
                )}
              </div>

              {/* Trust Level */}
              <div className="flex items-center gap-4 mb-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${TRUST_LEVEL_COLORS[profile.trustLevel] || TRUST_LEVEL_COLORS[0]}`}>
                  <Star size={14} />
                  {profile.trustLevelLabel}
                </span>
                <span className="text-sm text-gray-500">
                  {profile.reputation} reputation
                </span>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-gray-600 mb-3">{profile.bio}</p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  Joined {formatDate(profile.user.joinedAt)}
                </span>
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {profile.location}
                  </span>
                )}
                {profile.shelter && (
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {profile.shelter.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{profile.stats.threadsCount}</p>
              <p className="text-sm text-gray-500">Threads</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{profile.stats.postsCount}</p>
              <p className="text-sm text-gray-500">Replies</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{profile.stats.helpfulReceived}</p>
              <p className="text-sm text-gray-500">Helpful</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{profile.stats.solutionsCount}</p>
              <p className="text-sm text-gray-500">Solutions</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        {profile.badges?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Award size={20} className="text-amber-500" />
              Badges
            </h2>
            <div className="flex flex-wrap gap-3">
              {profile.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-flash-50 border border-flash-200 rounded-lg"
                  title={badge.description}
                >
                  <span className="text-xl">{badge.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{badge.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(badge.earnedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b">
            <div className="flex">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-midnight-900 border-b-2 border-flash-400 bg-flash-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity List */}
          <div className="divide-y">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 size={24} className="animate-spin text-midnight-400 mx-auto" />
              </div>
            ) : activity.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No activity found
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                  {item.type === 'thread' && (
                    <Link href={`/hub/thread/${item.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <FileText size={18} className="text-midnight-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-800 truncate">{item.title}</h3>
                            {item.isPinned && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">Pinned</span>
                            )}
                            {item.isSolved && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">Solved</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span
                              className="px-2 py-0.5 rounded text-white text-xs"
                              style={{ backgroundColor: item.category?.color || '#6366f1' }}
                            >
                              {item.category?.icon} {item.category?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} />
                              {item.replyCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={12} />
                              {item.viewCount}
                            </span>
                            <span>{formatRelativeTime(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {item.type === 'post' && (
                    <Link href={`/hub/thread/${item.thread?.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <MessageSquare size={18} className="text-green-500 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 mb-1">
                            Reply in <span className="font-medium text-gray-700">{item.thread?.title}</span>
                          </p>
                          <p className="text-gray-700">{item.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {item.isSolution && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle size={12} />
                                Solution
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <ThumbsUp size={12} />
                              {item.helpfulCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart size={12} />
                              {item.heartCount}
                            </span>
                            <span>{formatRelativeTime(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {item.type === 'reaction' && (
                    <Link href={`/hub/thread/${item.post?.thread?.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        {item.reactionType === 'HELPFUL' ? (
                          <ThumbsUp size={18} className="text-green-500 mt-1 flex-shrink-0" />
                        ) : (
                          <Heart size={18} className="text-pink-500 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 mb-1">
                            Gave {item.reactionType.toLowerCase()} to {item.post?.author}'s reply
                          </p>
                          <p className="text-gray-600 text-sm italic">"{item.post?.content}"</p>
                          <p className="text-xs text-gray-400 mt-1">
                            in {item.post?.thread?.title} · {formatRelativeTime(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
