'use client';

/**
 * CommunityModeV2 - Community posts, discussions, and engagement
 *
 * Features:
 * - Featured cases carousel
 * - Pinned announcements
 * - Post feed (Facebook-style)
 * - Rich post creation with images
 *
 * Note: Chat moved to dedicated channel system (Discord-style)
 */

import { useState } from 'react';
import { Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import FeaturedCasesCarousel from './FeaturedCasesCarousel';
import PostFeed from './PostFeed';
import CreatePostModal from './CreatePostModal';

export default function CommunityModeV2({
  squadId,
  messages = [],
  announcements = [],
  membership,
  isDivisionPage = false,
  divisionId = null,
  divisions = [],
  cases = [],
}) {
  const [showCreatePost, setShowCreatePost] = useState(false);

  return (
    <div className="space-y-6">
      {/* Featured Cases Carousel */}
      <FeaturedCasesCarousel cases={cases} />

      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => (
              <div
                key={announcement.id}
                className="relative overflow-hidden bg-gradient-to-br from-flash-400/10 via-flash-400/5 to-transparent backdrop-blur-sm border border-flash-400/40 rounded-2xl p-6 shadow-lg shadow-flash-400/10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-flash-400/5 rounded-full blur-2xl" />
                <div className="relative flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-flash-400/20 border border-flash-400/30">
                    <Pin className="text-flash-300 flex-shrink-0" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-flash-200 mb-2">
                      {announcement.title || 'Announcement'}
                    </h4>
                    <p className="text-slate-200 text-base leading-relaxed mb-3">{announcement.content}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {announcement.authorName} · {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Main Post Feed */}
      <PostFeed
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
        membership={membership}
        onCreatePost={() => setShowCreatePost(true)}
        currentUserId={membership?.userId}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={() => window.location.reload()}
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
      />
    </div>
  );
}
