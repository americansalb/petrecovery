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
import { Pin, Users, Shield, ArrowRight } from 'lucide-react';
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

      {/* Members Preview Section */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-flash-400/20 border border-flash-400/30">
              <Users className="text-flash-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Members</h3>
              <p className="text-sm text-slate-400">{members.length} total members</p>
            </div>
          </div>
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-flash-500/20 border border-flash-500/40 text-flash-300 hover:bg-flash-500/30 transition-all font-semibold text-sm"
          >
            <span>View All</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Members Grid - Show first 6 */}
        {loadingMembers ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : members.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {members.slice(0, 6).map(member => (
              <MemberPreviewCard key={member.id} member={member} currentUserId={membership?.userId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-slate-400 text-sm">No members yet</p>
          </div>
        )}
      </div>

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

function MemberPreviewCard({ member, currentUserId }) {
  const isFriend = member.isFriend || false;
  const isCurrentUser = member.userId === currentUserId;

  // Privacy: Show first name only for non-friends
  const displayName = isFriend || isCurrentUser
    ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
    : member.firstName || 'Anonymous';

  const roleColors = {
    FOUNDER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    MODERATOR: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    LEADER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    COORDINATOR: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    MEMBER: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
  };

  const roleStyle = roleColors[member.role] || roleColors.MEMBER;

  return (
    <div className="group bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600/70 hover:bg-slate-800/60 transition-all">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover border-2 border-slate-600/50 group-hover:border-flash-400/50 transition-colors flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold border-2 border-slate-600/50 group-hover:border-flash-400/50 transition-colors flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-bold text-white text-sm truncate">{displayName}</span>
            {isCurrentUser && (
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-flash-400/20 text-flash-300 border border-flash-400/30 flex-shrink-0">
                You
              </span>
            )}
          </div>
          {member.role && member.role !== 'MEMBER' && (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${roleStyle}`}>
              {member.role.toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
