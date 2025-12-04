'use client';

/**
 * PostCard - Facebook-style post card
 * Image-first, conversational design with reactions and comments
 */

import { useState } from 'react';
import { Heart, MessageCircle, Share2, ThumbsUp, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, onVote, onComment, currentUserId }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasLiked, setHasLiked] = useState(post.userVote === 1);

  const handleLike = async () => {
    const newLikeState = !hasLiked;
    setHasLiked(newLikeState);
    await onVote(post.id, newLikeState ? 1 : 0);
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
    FOUNDER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    MODERATOR: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    LEADER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    COORDINATOR: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    MEMBER: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
  };

  const roleStyle = roleColors[post.authorRole] || roleColors.MEMBER;
  const likeCount = post.upvotes || 0;

  return (
    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600/70 transition-all duration-300 shadow-lg">
      {/* Post Header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          {/* Larger Profile Picture */}
          <div className="flex-shrink-0">
            {post.isSystemPost ? (
              <>
                <img
                  src="/images/surumaa-avatar.png"
                  alt="Surumaa"
                  className="w-14 h-14 rounded-full object-cover shadow-lg ring-2 ring-purple-400/50 bg-gradient-to-br from-purple-500 to-purple-600"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg ring-2 ring-purple-400/50" style={{ display: 'none' }}>
                  🐾
                </div>
              </>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-slate-700/50">
                {post.authorName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Author Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-white text-base">
                {post.isSystemPost ? 'Surumaa' : post.authorName}
              </span>
              {post.isSystemPost ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Your Guide Home
                </span>
              ) : (
                post.authorRole && post.authorRole !== 'MEMBER' && (
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${roleStyle}`}>
                    {post.authorRole.toLowerCase()}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
              {post.divisionName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span>📍</span>
                    <span>{post.divisionName}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Post Content - Text first */}
        {post.content && (
          <p className="text-slate-100 text-base leading-relaxed mb-4 whitespace-pre-wrap">
            {post.content}
          </p>
        )}
      </div>

      {/* Post Image - Full width, image-first if exists */}
      {post.imageUrl && (
        <div className="relative group cursor-pointer">
          <img
            src={post.imageUrl}
            alt="Post image"
            className="w-full object-cover max-h-[500px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Engagement Stats */}
      {(likeCount > 0 || post.commentCount > 0) && (
        <div className="px-5 py-2 border-t border-slate-700/30 flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center gap-2">
            {likeCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex items-center -space-x-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
                    <Heart size={10} className="text-white fill-current" />
                  </div>
                </div>
                <span className="font-medium">{likeCount}</span>
              </div>
            )}
          </div>
          {post.commentCount > 0 && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="hover:text-white transition-colors font-medium"
            >
              {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {/* Action Buttons - Facebook style */}
      <div className="px-5 py-2.5 border-t border-slate-700/30 flex items-center gap-2">
        <button
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg transition-all duration-200 font-semibold text-sm ${
            hasLiked
              ? 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
              : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
          }`}
        >
          <Heart size={18} className={hasLiked ? 'fill-current' : ''} strokeWidth={2.5} />
          <span>{hasLiked ? 'Liked' : 'Like'}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-slate-400 hover:bg-slate-700/40 hover:text-white transition-all duration-200 font-semibold text-sm"
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          <span>Comment</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t-2 border-slate-700/50 bg-slate-900/30 px-5 py-4">
          {/* Comment Input */}
          <div className="mb-4">
            {replyingTo && (
              <div className="mb-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm text-orange-300 flex items-center justify-between">
                <span>Replying to <span className="font-bold">{replyingTo.authorName}</span></span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2 items-start">
              {/* User avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">
                {currentUserId?.charAt(0)?.toUpperCase() || 'Y'}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-slate-800/50 border border-slate-600/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/70 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                {commentText.trim() && (
                  <button
                    onClick={handleComment}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm disabled:opacity-50 hover:shadow-lg hover:shadow-orange-500/30 transition-all flex-shrink-0"
                  >
                    {submitting ? '...' : 'Post'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Comments List */}
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-3">
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
            <div className="text-center py-6 text-slate-500">
              <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentThread({ comment, onReply, onVote, currentUserId, depth = 0 }) {
  const [showReplies, setShowReplies] = useState(true);
  const [hasLiked, setHasLiked] = useState(comment.userVote === 1);
  const maxDepth = 3; // Reduced nesting for cleaner FB style

  const handleLike = async () => {
    const newLikeState = !hasLiked;
    setHasLiked(newLikeState);
    await onVote(comment.id, newLikeState ? 1 : 0, true);
  };

  const likeCount = comment.upvotes || 0;

  const roleColors = {
    FOUNDER: 'text-purple-400',
    ADMIN: 'text-purple-400',
    MODERATOR: 'text-amber-400',
    LEADER: 'text-amber-400',
    COORDINATOR: 'text-blue-400',
    MEMBER: 'text-slate-400',
  };

  return (
    <div className={`${depth > 0 ? 'ml-10' : ''}`}>
      <div className="flex gap-2.5 group">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold">
            {comment.authorName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          {/* Comment Bubble */}
          <div className="bg-slate-800/50 rounded-2xl px-4 py-2.5 inline-block max-w-full">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white text-sm">{comment.authorName}</span>
              {comment.authorRole && comment.authorRole !== 'MEMBER' && (
                <span className={`text-xs font-semibold ${roleColors[comment.authorRole] || 'text-slate-400'}`}>
                  {comment.authorRole.toLowerCase()}
                </span>
              )}
            </div>
            <p className="text-slate-100 text-sm leading-relaxed">{comment.content}</p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center gap-3 mt-1 px-2 text-xs">
            <button
              onClick={handleLike}
              className={`font-semibold transition-colors ${
                hasLiked ? 'text-orange-400' : 'text-slate-500 hover:text-orange-400'
              }`}
            >
              {hasLiked ? 'Liked' : 'Like'}
              {likeCount > 0 && ` (${likeCount})`}
            </button>

            {depth < maxDepth && (
              <button
                onClick={() => onReply(comment)}
                className="font-semibold text-slate-500 hover:text-white transition-colors"
              >
                Reply
              </button>
            )}

            <span className="text-slate-600">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>

            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="font-semibold text-slate-500 hover:text-white transition-colors flex items-center gap-1"
              >
                {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
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
