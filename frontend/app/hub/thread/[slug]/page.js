'use client';

/**
 * Thread View Page
 *
 * Shows a single forum thread with all posts and replies.
 */

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bookmark, BookmarkCheck, Pin, Lock, CheckCircle,
  AlertTriangle, MessageSquare, Eye, Clock, Heart, ThumbsUp,
  MoreVertical, Flag, Edit2, Trash2, Loader2, Send, Image,
  MapPin, Share2, Shield, Unlock, Move, RotateCcw
} from 'lucide-react';

const URGENCY_STYLES = {
  NORMAL: null,
  URGENT: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
};

export default function ThreadPage({ params }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();

  const [thread, setThread] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showModMenu, setShowModMenu] = useState(false);
  const [modAction, setModAction] = useState(null);
  const [categories, setCategories] = useState([]);

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
        setBookmarked(data.thread.isBookmarked || false);
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
        // Add new post to thread
        setThread(prev => ({
          ...prev,
          posts: [...prev.posts, data.post],
          replyCount: prev.replyCount + 1,
        }));
        setReplyContent('');
      } else if (data.code === 'EMAIL_NOT_VERIFIED') {
        alert('Please verify your email to post on the forum. Check your inbox for a verification link.');
      } else {
        alert(data.error || 'Failed to post reply');
      }
    } catch (err) {
      alert('Failed to post reply');
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
        // Update local state
        setThread(prev => ({
          ...prev,
          posts: prev.posts.map(post => {
            if (post.id === postId) {
              const countField = type === 'HELPFUL' ? 'helpfulCount' :
                                 type === 'HEART' ? 'heartCount' : 'thanksCount';
              return {
                ...post,
                [countField]: post[countField] + 1,
                reactions: [...post.reactions, { type, userId: currentUserId }],
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

  const toggleBookmark = async () => {
    if (!session) {
      router.push(`/login?redirect=/hub/thread/${slug}`);
      return;
    }

    try {
      if (bookmarked) {
        await fetch(`/api/hub/bookmarks?threadId=${thread.id}`, { method: 'DELETE' });
      } else {
        await fetch('/api/hub/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: thread.id }),
        });
      }
      setBookmarked(!bookmarked);
    } catch (err) {
      console.error('Bookmark failed:', err);
    }
  };

  const handleModAction = async (action, data = {}) => {
    if (!isMod) return;

    try {
      setModAction(action);
      const res = await fetch('/api/hub/mod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          threadId: thread.id,
          ...data,
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Refresh thread data
        fetchThread();
        setShowModMenu(false);
      } else {
        alert(result.error || 'Action failed');
      }
    } catch (err) {
      console.error('Mod action failed:', err);
      alert('Action failed');
    } finally {
      setModAction(null);
    }
  };

  const handlePostModAction = async (action, postId) => {
    if (!isMod) return;

    try {
      const res = await fetch('/api/hub/mod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          postId,
          threadId: thread.id,
        }),
      });

      const result = await res.json();

      if (result.success) {
        fetchThread();
      } else {
        alert(result.error || 'Action failed');
      }
    } catch (err) {
      console.error('Mod action failed:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/hub/mod');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading thread...</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Thread not found</h2>
          <p className="text-gray-500 mb-4">{error || 'This thread may have been removed.'}</p>
          <Link
            href="/hub"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Return to Hub
          </Link>
        </div>
      </div>
    );
  }

  const urgencyStyle = URGENCY_STYLES[thread.urgencyLevel];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/hub/c/${thread.category?.slug || 'general'}`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span
                className="px-2 py-1 rounded text-sm font-medium text-white"
                style={{ backgroundColor: thread.category?.color || '#6366f1' }}
              >
                {thread.category?.icon} {thread.category?.name}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleBookmark}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title={bookmarked ? 'Remove bookmark' : 'Bookmark thread'}
              >
                {bookmarked ? (
                  <BookmarkCheck size={20} className="text-indigo-600" />
                ) : (
                  <Bookmark size={20} className="text-gray-400" />
                )}
              </button>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Share"
              >
                <Share2 size={20} className="text-gray-400" />
              </button>

              {/* Mod Menu */}
              {isMod && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowModMenu(!showModMenu);
                      if (!showModMenu && categories.length === 0) {
                        fetchCategories();
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-purple-100 transition-colors"
                    title="Moderation"
                  >
                    <Shield size={20} className="text-purple-600" />
                  </button>

                  {showModMenu && (
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                        Thread Actions
                      </div>

                      {thread?.isLocked ? (
                        <button
                          onClick={() => handleModAction('unlock_thread')}
                          disabled={!!modAction}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Unlock size={16} />
                          Unlock Thread
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModAction('lock_thread')}
                          disabled={!!modAction}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Lock size={16} />
                          Lock Thread
                        </button>
                      )}

                      {thread?.isPinned ? (
                        <button
                          onClick={() => handleModAction('unpin_thread')}
                          disabled={!!modAction}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Pin size={16} />
                          Unpin Thread
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModAction('pin_thread')}
                          disabled={!!modAction}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Pin size={16} />
                          Pin Thread
                        </button>
                      )}

                      <div className="border-t my-1" />
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                        Move To
                      </div>

                      {categories.filter(c => c.id !== thread?.categoryId).slice(0, 5).map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleModAction('move_thread', { categoryId: cat.id })}
                          disabled={!!modAction}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <span>{cat.icon}</span>
                          {cat.name}
                        </button>
                      ))}

                      <div className="border-t my-1" />

                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this thread?')) {
                            handleModAction('delete_thread');
                          }
                        }}
                        disabled={!!modAction}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Delete Thread
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Urgency Banner */}
        {urgencyStyle && (
          <div className={`${urgencyStyle.bg} border ${urgencyStyle.badge} rounded-xl p-4 mb-6 flex items-center gap-3`}>
            <AlertTriangle className={urgencyStyle.text} size={24} />
            <div>
              <span className={`font-semibold ${urgencyStyle.text}`}>
                {thread.urgencyLevel} Alert
              </span>
              <p className={`text-sm ${urgencyStyle.text} opacity-80`}>
                This post requires immediate attention
              </p>
            </div>
          </div>
        )}

        {/* Thread Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            {/* Author Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {thread.author?.firstName?.[0] || '?'}
            </div>

            <div className="flex-1">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {thread.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                    <Pin size={12} />
                    Pinned
                  </span>
                )}
                {thread.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                    <Lock size={12} />
                    Locked
                  </span>
                )}
                {thread.isSolved && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    <CheckCircle size={12} />
                    Solved
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
                {thread.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="font-medium text-gray-700">
                  {thread.author?.firstName} {thread.author?.lastName?.[0]}.
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatTime(thread.createdAt)}
                </span>
                {thread.locationTag && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {thread.locationTag}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{thread.content}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-6 pt-4 border-t text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye size={16} />
                  {thread.viewCount} views
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={16} />
                  {thread.replyCount} replies
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {thread.posts?.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              {thread.posts.length} {thread.posts.length === 1 ? 'Reply' : 'Replies'}
            </h2>
            {thread.posts.map((post) => {
              const isAuthor = post.authorId === currentUserId;
              const hasReacted = (type) => post.reactions?.some(
                r => r.userId === currentUserId && r.type === type
              );

              return (
                <div
                  key={post.id}
                  className={`bg-white rounded-xl shadow-sm p-5 ${
                    post.isSolution ? 'ring-2 ring-green-500' : ''
                  }`}
                >
                  {post.isSolution && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-3">
                      <CheckCircle size={16} />
                      Marked as Solution
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {post.author?.firstName?.[0] || '?'}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-800">
                          {post.author?.firstName}
                        </span>
                        {post.authorProfile?.isModerator && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                            Mod
                          </span>
                        )}
                        {post.authorProfile?.isVerifiedShelter && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                            Shelter
                          </span>
                        )}
                        <span className="text-sm text-gray-400">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                        {post.editedAt && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>

                      <p className="text-gray-700 whitespace-pre-wrap mb-3">
                        {post.content}
                      </p>

                      {/* Reactions and Mod Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleReaction(post.id, 'HELPFUL')}
                            disabled={isAuthor}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                              hasReacted('HELPFUL')
                                ? 'bg-green-100 text-green-700'
                                : 'text-gray-500 hover:bg-gray-100'
                            } ${isAuthor ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <ThumbsUp size={14} />
                            <span>{post.helpfulCount || 0}</span>
                          </button>
                          <button
                            onClick={() => handleReaction(post.id, 'HEART')}
                            disabled={isAuthor}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                              hasReacted('HEART')
                                ? 'bg-pink-100 text-pink-700'
                                : 'text-gray-500 hover:bg-gray-100'
                            } ${isAuthor ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Heart size={14} />
                            <span>{post.heartCount || 0}</span>
                          </button>
                        </div>

                        {/* Mod controls for posts */}
                        {isMod && (
                          <div className="flex items-center gap-2">
                            {!post.isSolution ? (
                              <button
                                onClick={() => handlePostModAction('mark_solution', post.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-green-600 hover:bg-green-50 transition-colors"
                                title="Mark as solution"
                              >
                                <CheckCircle size={14} />
                                <span className="hidden sm:inline">Solution</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePostModAction('unmark_solution', post.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                                title="Unmark solution"
                              >
                                <RotateCcw size={14} />
                                <span className="hidden sm:inline">Unmark</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Delete this reply?')) {
                                  handlePostModAction('delete_post', post.id);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete post"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply Form */}
        {thread.isLocked ? (
          <div className="bg-gray-100 rounded-xl p-6 text-center">
            <Lock size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">This thread is locked and cannot receive new replies.</p>
          </div>
        ) : session ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Reply to this thread</h3>
            <form onSubmit={handleReply}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Share your thoughts, advice, or encouragement..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submitting}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <p className="text-gray-600 mb-4">Sign in to join the conversation</p>
            <Link
              href={`/login?redirect=/hub/thread/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Sign In to Reply
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
