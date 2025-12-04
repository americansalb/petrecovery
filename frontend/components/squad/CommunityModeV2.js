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
import FeaturedCasesCarousel from './FeaturedCasesCarousel';
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
  mascotName = 'PetRecovery Bot',
  stats = {},
}) {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [squadId]);

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/members`);
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
      {/* Stats Bar */}
      {stats && (
        <div className="flex items-center gap-6 text-sm bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-bold">{stats.active || 0}</span>
            <span className="text-slate-400">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-white font-bold">{stats.reunited || 0}</span>
            <span className="text-slate-400">Reunited</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-white font-bold">{stats.members || 0}</span>
            <span className="text-slate-400">Members</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-flash-300" />
            <span className="text-white font-bold">{stats.onDuty || 0}</span>
            <span className="text-slate-400">On Duty</span>
          </div>
        </div>
      )}

      {/* Featured Cases Carousel */}
      <FeaturedCasesCarousel cases={cases} />

      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => {
              const isMascot = announcement.isSystemPost || announcement.authorName === mascotName;
              const announcementColor = isMascot ? 'purple' : 'flash';

              return (
                <div
                  key={announcement.id}
                  className={`relative overflow-hidden bg-gradient-to-br from-${announcementColor}-400/10 via-${announcementColor}-400/5 to-transparent backdrop-blur-sm border border-${announcementColor}-400/40 rounded-2xl p-6 shadow-lg`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-${announcementColor}-400/5 rounded-full blur-2xl`} />
                  <div className="relative flex items-start gap-4">
                    {isMascot ? (
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-2xl border-2 border-purple-400/50 shadow-lg">
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
                            Community Guide
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
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
        membership={membership}
        onCreatePost={() => setShowCreatePost(true)}
        currentUserId={membership?.userId}
        onViewMembers={() => setShowMembersModal(true)}
        membersCount={members.length}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={() => window.location.reload()}
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
      />
    </div>
  );
}
