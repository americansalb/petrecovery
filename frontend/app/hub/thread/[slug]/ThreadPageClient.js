'use client';

/**
 * Thread View Page
 *
 * Classic forum thread view with user info panels on each post.
 * Shows author info, post count, join date, and badges.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/Toast';
import {
  Pin, Lock, CheckCircle, AlertTriangle, MessageSquare, Eye,
  Clock, Heart, ThumbsUp, Trash2, Loader2, Send, MapPin,
  Home, ChevronRight, Quote, Shield, Award, Calendar, User
} from 'lucide-react';

export default function ThreadPage({ params }) {
  const { slug } = params;
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [thread, setThread] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(null);

  const isMod = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

  useEffect(() => {
    fetchThread();
  }, [slug]);

  const fetchThread = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hub/threads/${slug}`);
      const data = await res.json();

      if (data.success) {
        setThread(data.thread);
        setCurrentUserId(data.currentUserId);
      } else {
        setError(data.error || 'Thread not found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/hub/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.id,
          content: replyContent,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setThread(prev => ({
          ...prev,
          posts: [...prev.posts, data.post],
          replyCount: prev.replyCount + 1,
        }));
        setReplyContent('');
        setQuoting(null);
      } else if (data.code === 'EMAIL_NOT_VERIFIED') {
        toast.warning('Please verify your email to post. Check your inbox.');
      } else {
        toast.error(data.error || 'Failed to post.');
      }
    } catch (err) {
      toast.error('Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (postId, type) => {
    if (!session) {
      router.push(`/login?redirect=/hub/thread/${slug}`);
      return;
    }

    try {
      const res = await fetch(`/api/hub/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        setThread(prev => ({
          ...prev,
          posts: prev.posts.map(post => {
            if (post.id === postId) {
              const countField = type === 'HELPFUL' ? 'helpfulCount' : 'heartCount';
              return {
                ...post,
                [countField]: post[countField] + 1,
                reactions: [...(post.reactions || []), { type, userId: currentUserId }],
              };
            }
            return post;
          }),
        }));
      }
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  const handleQuote = (post) => {
    const quotedText = `> **${post.author?.firstName}** wrote:\n> ${post.content.split('\n').join('\n> ')}\n\n`;
    setReplyContent(quotedText);
    setQuoting(post.id);
    document.getElementById('reply-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModAction = async (action, data = {}) => {
    if (!isMod) return;

    try {
      const res = await fetch('/api/hub/mod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, threadId: thread.id, ...data }),
      });

      const result = await res.json();
      if (result.success) {
        fetchThread();
      } else {
        toast.error(result.error || 'Action failed.');
      }
    } catch (err) {
      toast.error('Action failed.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatJoinDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const getTrustLevelLabel = (level) => {
    const labels = {
      0: 'New Member',
      1: 'Member',
      2: 'Regular',
      3: 'Trusted',
      4: 'Leader',
    };
    return labels[level] || 'Member';
  };

  const getTrustLevelColor = (level) => {
    const colors = {
      0: 'text-slate-500',
      1: 'text-blue-600',
      2: 'text-green-600',
      3: 'text-purple-600',
      4: 'text-amber-600',
    };
    return colors[level] || 'text-slate-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading thread...</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Thread not found</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <Link href="/hub" className="text-blue-600 hover:underline">
            Return to Forum
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/hub" className="hover:text-blue-600 flex items-center gap-1">
              <Home size={14} />
              Forum
            </Link>
            <ChevronRight size={14} />
            <Link
              href={`/hub/c/${thread.category?.slug || 'general'}`}
              className="hover:text-blue-600 flex items-center gap-1"
              style={{ color: thread.category?.color }}
            >
              <span>{thread.category?.icon}</span>
              {thread.category?.name}
            </Link>
            <ChevronRight size={14} />
            <span className="text-slate-700 truncate max-w-xs">{thread.title}</span>
          </div>

          {/* Thread Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {thread.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                    <Pin size={12} />
                    Pinned
                  </span>
                )}
                {thread.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">
                    <Lock size={12} />
                    Locked
                  </span>
                )}
                {thread.isSolved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                    <CheckCircle size={12} />
                    Solved
                  </span>
                )}
                {thread.urgencyLevel === 'URGENT' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                    <AlertTriangle size={12} />
                    Urgent
                  </span>
                )}
                {thread.urgencyLevel === 'CRITICAL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                    <AlertTriangle size={12} />
                    Critical
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-800">{thread.title}</h1>
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {thread.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={14} />
                {thread.replyCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Original Post */}
        <div className="mb-6">
          <ForumPost
            post={{
              id: 'op',
              content: thread.content,
              author: thread.author,
              authorProfile: thread.authorProfile,
              createdAt: thread.createdAt,
              helpfulCount: 0,
              heartCount: 0,
              reactions: [],
            }}
            isOriginalPost
            formatDate={formatDate}
            formatJoinDate={formatJoinDate}
            getTrustLevelLabel={getTrustLevelLabel}
            getTrustLevelColor={getTrustLevelColor}
            onQuote={handleQuote}
            onReaction={() => {}}
            currentUserId={currentUserId}
            isMod={isMod}
            locationTag={thread.locationTag}
          />
        </div>

        {/* Replies */}
        {thread.posts?.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <MessageSquare size={20} />
              {thread.posts.length} {thread.posts.length === 1 ? 'Reply' : 'Replies'}
            </h2>

            {thread.posts.map((post) => (
              <ForumPost
                key={post.id}
                post={post}
                formatDate={formatDate}
                formatJoinDate={formatJoinDate}
                getTrustLevelLabel={getTrustLevelLabel}
                getTrustLevelColor={getTrustLevelColor}
                onQuote={handleQuote}
                onReaction={handleReaction}
                currentUserId={currentUserId}
                isMod={isMod}
                onMarkSolution={(postId) => handleModAction('mark_solution', { postId })}
                onDelete={(postId) => {
                  if (confirm('Delete this reply?')) {
                    handleModAction('delete_post', { postId });
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Reply Form */}
        <div id="reply-form">
          {thread.isLocked ? (
            <div className="bg-slate-100 rounded-lg p-6 text-center border border-slate-200">
              <Lock size={24} className="mx-auto mb-2 text-slate-400" />
              <p className="text-slate-600">This thread is locked.</p>
            </div>
          ) : session ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700">Post a Reply</h3>
              </div>
              <form onSubmit={handleReply} className="p-4">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-slate-500">
                    Tip: Be helpful and respectful
                  </div>
                  <button
                    type="submit"
                    disabled={!replyContent.trim() || submitting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    Post Reply
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center">
              <User size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600 mb-4">Sign in to join the conversation</p>
              <Link
                href={`/login?redirect=/hub/thread/${slug}`}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Sign In to Reply
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Forum Post Component with User Info Panel
function ForumPost({
  post,
  isOriginalPost,
  formatDate,
  formatJoinDate,
  getTrustLevelLabel,
  getTrustLevelColor,
  onQuote,
  onReaction,
  currentUserId,
  isMod,
  onMarkSolution,
  onDelete,
  locationTag,
}) {
  const isAuthor = post.authorId === currentUserId;
  const hasReacted = (type) => post.reactions?.some(r => r.userId === currentUserId && r.type === type);
  const profile = post.authorProfile || {};

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden ${
      post.isSolution ? 'ring-2 ring-green-500' : ''
    }`}>
      {post.isSolution && (
        <div className="bg-green-500 text-white px-4 py-2 text-sm font-medium flex items-center gap-2">
          <CheckCircle size={16} />
          Accepted Solution
        </div>
      )}

      <div className="flex flex-col sm:flex-row">
        {/* User Info Panel (Left Side) */}
        <div className="sm:w-48 p-4 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100 flex-shrink-0">
          <Link href={`/hub/u/${post.author?.id}`} className="block text-center">
            {/* Avatar */}
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-2">
              {post.author?.firstName?.[0] || '?'}
            </div>

            {/* Username */}
            <div className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">
              {post.author?.firstName || 'Unknown'}
            </div>
          </Link>

          {/* Trust Level */}
          <div className={`text-xs font-medium mt-1 ${getTrustLevelColor(profile.trustLevel || 0)}`}>
            {getTrustLevelLabel(profile.trustLevel || 0)}
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
            {profile.isModerator && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium flex items-center gap-0.5">
                <Shield size={10} />
                Mod
              </span>
            )}
            {profile.isVerifiedShelter && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                Shelter
              </span>
            )}
            {profile.isVerifiedRescue && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                Rescue
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-1 justify-center">
              <MessageSquare size={10} />
              <span>{profile.postsCount || 0} posts</span>
            </div>
            <div className="flex items-center gap-1 justify-center">
              <Calendar size={10} />
              <span>Joined {formatJoinDate(post.author?.createdAt)}</span>
            </div>
            {profile.reputation > 0 && (
              <div className="flex items-center gap-1 justify-center">
                <Award size={10} />
                <span>{profile.reputation} rep</span>
              </div>
            )}
          </div>
        </div>

        {/* Post Content (Right Side) */}
        <div className="flex-1 p-4">
          {/* Post Header */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock size={14} />
              {formatDate(post.createdAt)}
              {post.editedAt && (
                <span className="text-slate-400">(edited)</span>
              )}
            </div>
            {!isOriginalPost && (
              <div className="text-xs text-slate-400">
                #{post.postNumber || ''}
              </div>
            )}
          </div>

          {/* Location Tag (for OP) */}
          {locationTag && isOriginalPost && (
            <div className="flex items-center gap-1 text-sm text-slate-500 mb-3 p-2 bg-slate-50 rounded">
              <MapPin size={14} />
              {locationTag}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap">
            {post.content}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {!isOriginalPost && (
                <>
                  <button
                    onClick={() => onReaction(post.id, 'HELPFUL')}
                    disabled={isAuthor}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
                      hasReacted('HELPFUL')
                        ? 'bg-green-100 text-green-700'
                        : 'text-slate-500 hover:bg-slate-100'
                    } ${isAuthor ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ThumbsUp size={14} />
                    <span>{post.helpfulCount || 0}</span>
                  </button>
                  <button
                    onClick={() => onReaction(post.id, 'HEART')}
                    disabled={isAuthor}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
                      hasReacted('HEART')
                        ? 'bg-pink-100 text-pink-700'
                        : 'text-slate-500 hover:bg-slate-100'
                    } ${isAuthor ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Heart size={14} />
                    <span>{post.heartCount || 0}</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onQuote(post)}
                className="flex items-center gap-1 px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <Quote size={14} />
                Quote
              </button>

              {/* Mod Actions */}
              {isMod && !isOriginalPost && (
                <div className="flex items-center gap-1">
                  {!post.isSolution && onMarkSolution && (
                    <button
                      onClick={() => onMarkSolution(post.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-sm text-green-600 hover:bg-green-50 transition-colors"
                      title="Mark as solution"
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(post.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-sm text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
