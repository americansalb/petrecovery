'use client';

/**
 * PostCard - Individual post with upvotes, comments, and threading
 * Reddit-style voting system + Facebook-style engagement
 */

import { useState } from 'react';
import { ArrowUp, ArrowDown, MessageCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, onVote, onComment, currentUserId }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const userVote = post.userVote; // 1 for upvote, -1 for downvote, 0 for none
  const netVotes = post.upvotes - post.downvotes;

  const handleVote = async (voteType) => {
    await onVote(post.id, voteType);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      await onComment(post.id, commentText, replyingTo);
      setCommentText('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const roleColors = {
    FOUNDER: 'text-purple-400',
    ADMIN: 'text-purple-400',
    MODERATOR: 'text-flash-300',
    LEADER: 'text-flash-300',
    COORDINATOR: 'text-blue-400',
    MEMBER: 'text-slate-400',
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl overflow-hidden hover:border-slate-600/80 transition-all duration-300 shadow-lg hover:shadow-xl">
      <div className="p-6">
        {/* Author Info */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-flash-500 to-flash-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {post.authorName?.charAt(0) || '?'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <span className="font-bold text-white text-lg">{post.authorName}</span>
              {post.authorRole && (
                <span className={`text-xs font-semibold uppercase tracking-wide ${roleColors[post.authorRole] || 'text-slate-400'}`}>
                  {post.authorRole.toLowerCase()}
                </span>
              )}
              {post.divisionName && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-flash-500/20 text-flash-300 border border-flash-500/40">
                  📍 {post.divisionName}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 font-medium">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Post Title (if exists) */}
        {post.title && (
          <h3 className="text-2xl font-bold text-white mb-3 leading-tight">
            {post.title}
          </h3>
        )}

        {/* Post Content */}
        <p className="text-slate-200 text-base leading-relaxed mb-4 whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Post Image */}
        {post.imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border-2 border-slate-700/50">
            <img
              src={post.imageUrl}
              alt="Post image"
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}

        {/* Engagement Bar */}
        <div className="flex items-center gap-6 pt-4 border-t border-slate-700/50">
          {/* Voting */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote(1)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                userVote === 1
                  ? 'bg-flash-500/30 text-flash-400 shadow-md shadow-flash-500/20'
                  : 'hover:bg-slate-700/50 text-slate-400 hover:text-flash-400'
              }`}
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
            <span className={`font-bold text-lg min-w-[3ch] text-center ${
              netVotes > 0 ? 'text-flash-400' : netVotes < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {netVotes > 0 ? '+' : ''}{netVotes}
            </span>
            <button
              onClick={() => handleVote(-1)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                userVote === -1
                  ? 'bg-red-500/30 text-red-400 shadow-md shadow-red-500/20'
                  : 'hover:bg-slate-700/50 text-slate-400 hover:text-red-400'
              }`}
            >
              <ArrowDown size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Comments Toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all group"
          >
            <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
            <span className="font-semibold">{post.commentCount || 0}</span>
            <span className="text-sm">Comments</span>
            {showComments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t-2 border-slate-700/60 bg-slate-900/40 p-6">
          {/* Comment Input */}
          <div className="mb-6">
            {replyingTo && (
              <div className="mb-2 px-3 py-2 bg-flash-500/10 border border-flash-500/30 rounded-lg text-sm text-flash-300 flex items-center justify-between">
                <span>Replying to <span className="font-bold">{replyingTo.authorName}</span></span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                placeholder="Write a comment..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border-2 border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-flash-500/70 focus:ring-2 focus:ring-flash-500/30 transition-all"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-bold disabled:opacity-50 hover:shadow-lg hover:shadow-flash-500/30 transition-all"
              >
                {submitting ? '...' : 'Post'}
              </button>
            </div>
          </div>

          {/* Comments List */}
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-4">
              {post.comments.map(comment => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  onReply={(comment) => setReplyingTo(comment)}
                  onVote={onVote}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No comments yet. Be the first to comment!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentThread({ comment, onReply, onVote, currentUserId, depth = 0 }) {
  const [showReplies, setShowReplies] = useState(true);
  const maxDepth = 5; // Maximum nesting level

  const userVote = comment.userVote;
  const netVotes = comment.upvotes - comment.downvotes;

  const roleColors = {
    FOUNDER: 'text-purple-400',
    ADMIN: 'text-purple-400',
    MODERATOR: 'text-flash-300',
    LEADER: 'text-flash-300',
    COORDINATOR: 'text-blue-400',
    MEMBER: 'text-slate-400',
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-slate-700/50' : ''}`}>
      <div className="bg-slate-800/40 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
        {/* Comment Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold">
            {comment.authorName?.charAt(0) || '?'}
          </div>
          <span className="font-bold text-white">{comment.authorName}</span>
          {comment.authorRole && (
            <span className={`text-xs font-semibold uppercase ${roleColors[comment.authorRole] || 'text-slate-400'}`}>
              {comment.authorRole.toLowerCase()}
            </span>
          )}
          <span className="text-xs text-slate-500">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Comment Content */}
        <p className="text-slate-200 mb-3 leading-relaxed">{comment.content}</p>

        {/* Comment Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onVote(comment.id, 1, true)}
              className={`p-1 rounded transition-all ${
                userVote === 1 ? 'text-flash-400' : 'text-slate-500 hover:text-flash-400'
              }`}
            >
              <ArrowUp size={14} />
            </button>
            <span className={`text-sm font-bold ${
              netVotes > 0 ? 'text-flash-400' : netVotes < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {netVotes}
            </span>
            <button
              onClick={() => onVote(comment.id, -1, true)}
              className={`p-1 rounded transition-all ${
                userVote === -1 ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
              }`}
            >
              <ArrowDown size={14} />
            </button>
          </div>

          {depth < maxDepth && (
            <button
              onClick={() => onReply(comment)}
              className="text-xs font-semibold text-slate-400 hover:text-flash-400 transition-colors"
            >
              Reply
            </button>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onVote={onVote}
              currentUserId={currentUserId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
