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

import { useState, useEffect } from 'react';
import { Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import FeaturedMissions from './FeaturedMissionsCarousel';
import { SARAMA_AVATAR, SARAMA_TAGLINE } from '@/lib/brandAssets';
import PostFeed from './PostFeed';
import CreatePostModal from './CreatePostModal';
import MembersModal from './MembersModal';

export default function CommunityModeV2({
  squadId,
  messages = [],
  announcements = [],
  membership,
  isDivisionPage = false,
  divisionId = null,
  divisions = [],
  cases = [],
  squadName = '',
  mascotName = 'Sarama',
  stats = {},
}) {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [squadId]);

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/rescue-forces/${squadId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Featured Cases */}
      <FeaturedMissions cases={cases} />

      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => {
              const isMascot = announcement.isSystemPost || announcement.authorName === mascotName;

              return (
                <div
                  key={announcement.id}
                  className={`relative overflow-hidden backdrop-blur-sm rounded-2xl p-6 shadow-lg ${
                    isMascot
                      ? 'bg-gradient-to-br from-purple-400/10 via-purple-400/5 to-transparent border border-purple-400/40'
                      : 'bg-gradient-to-br from-flash-400/10 via-flash-400/5 to-transparent border border-flash-400/40'
                  }`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${
                    isMascot ? 'bg-purple-400/5' : 'bg-flash-400/5'
                  }`} />
                  <div className="relative flex items-start gap-4">
                    {isMascot ? (
                      <div className="flex-shrink-0">
                        <img
                          src={SARAMA_AVATAR}
                          alt="Sarama"
                          className="w-14 h-14 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-2xl border-2 border-purple-400/50 shadow-lg" style={{ display: 'none' }}>
                          🐾
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-flash-400/20 border border-flash-400/30">
                        <Pin className="text-flash-300 flex-shrink-0" size={20} />
                      </div>
                    )}
                    <div className="flex-1">
                      {isMascot && (
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-purple-200">{mascotName}</h3>
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {SARAMA_TAGLINE}
                          </span>
                        </div>
                      )}
                      <h4 className={`font-bold text-lg mb-2 ${isMascot ? 'text-slate-200' : 'text-flash-200'}`}>
                        {announcement.title || 'Announcement'}
                      </h4>
                      <p className="text-slate-200 text-base leading-relaxed mb-3 whitespace-pre-wrap">{announcement.content}</p>
                      {!isMascot && (
                        <p className="text-xs text-slate-500 font-medium">
                          {announcement.authorName} · {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Main Post Feed */}
      <PostFeed
        key={refreshKey}
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
        membership={membership}
        onCreatePost={() => setShowCreatePost(true)}
        currentUserId={membership?.userId}
        onViewMembers={() => setShowMembersModal(true)}
        membersCount={stats.members || members.length}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={() => setRefreshKey(k => k + 1)}
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
      />

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        squadId={squadId}
        currentUserId={membership?.userId}
        members={members}
        totalCount={stats.members}
      />
    </div>
  );
}
