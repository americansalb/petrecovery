'use client';

/**
 * PostFeed - Main post feed with sorting and filtering
 * Facebook + Reddit style community feed
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Clock, Trophy, Plus, Users } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import PostCard from './PostCard';

export default function PostFeed({
  squadId,
  divisionId = null,
  membership,
  onCreatePost,
  currentUserId,
  onViewMembers,
  membersCount = 0,
}) {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('hot'); // 'hot', 'new', 'top'

  useEffect(() => {
    loadPosts();
  }, [squadId, divisionId, sortBy]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sortBy,
        ...(divisionId && { divisionId }),
      });

      const res = await fetch(`/api/rescue-forces/${squadId}/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      } else if (res.status === 500) {
        // Database migration may not have run yet
        console.warn('Posts feature not available - database migration may be needed');
        setPosts([]);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId, voteType, isComment = false) => {
    try {
      const endpoint = isComment
        ? `/api/rescue-forces/${squadId}/comments/${postId}/vote`
        : `/api/rescue-forces/${squadId}/posts/${postId}/vote`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteType }),
      });

      if (res.ok) {
        loadPosts(); // Refresh to show updated votes
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      toast.error('Failed to vote.');
    }
  };

  const handleComment = async (postId, content, replyTo = null) => {
    try {
      const res = await fetch(`/api/rescue-forces/${squadId}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          parentCommentId: replyTo?.id,
        }),
      });

      if (res.ok) {
        loadPosts(); // Refresh to show new comment
      }
    } catch (error) {
      console.error('Failed to comment:', error);
      toast.error('Failed to post comment.');
    }
  };

  const sortOptions = [
    { value: 'hot', label: 'Hot', icon: TrendingUp, description: 'Trending posts' },
    { value: 'new', label: 'New', icon: Clock, description: 'Most recent' },
    { value: 'top', label: 'Top', icon: Trophy, description: 'Most upvoted' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Sort Options */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* Compact Sort Filters */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-800/60 rounded-lg border border-slate-700/50">
            {sortOptions.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-all duration-200
                    ${sortBy === option.value
                      ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }
                  `}
                  title={option.description}
                >
                  <Icon size={14} strokeWidth={2.5} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          {/* Members Button */}
          {onViewMembers && (
            <button
              onClick={onViewMembers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-700/50 bg-slate-800/60 border border-slate-700/50"
              title="View all members"
            >
              <Users size={14} strokeWidth={2.5} />
              <span>Members</span>
              {membersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">
                  {membersCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Create Post Button */}
        {membership?.isMember && (
          <button
            onClick={onCreatePost}
            className="group relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 font-bold shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50 hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <Plus size={18} strokeWidth={2.5} />
              <span>New Post</span>
            </div>
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-64 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-2xl border border-slate-700/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Posts List */}
      {!loading && posts.length > 0 && (
        <div className="space-y-5">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onVote={handleVote}
              onComment={handleComment}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-20 text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-flash-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="text-7xl mb-6">📝</div>
            <h3 className="text-2xl font-bold text-white mb-3">
              No posts yet
            </h3>
            <p className="text-slate-400 text-lg mb-6">
              Be the first to share something with the community!
            </p>
            {membership?.isMember && (
              <button
                onClick={onCreatePost}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-white font-bold shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50 hover:scale-105 transition-all"
              >
                <Plus size={20} />
                <span>Create First Post</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
