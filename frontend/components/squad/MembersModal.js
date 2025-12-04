'use client';

/**
 * MembersModal - View squad members with privacy controls
 *
 * Privacy Rules:
 * - Non-friends see: First name only, date joined, groups in common
 * - Friends see: Full profile
 */

import { useState, useEffect } from 'react';
import { X, Users, Calendar, Shield, Search, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function MembersModal({ isOpen, onClose, squadId, currentUserId, members: initialMembers }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchedMembers, setFetchedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch members if not provided as prop
  useEffect(() => {
    if (isOpen && !initialMembers && squadId) {
      loadMembers();
    }
  }, [isOpen, squadId, initialMembers]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/members`);
      if (res.ok) {
        const data = await res.json();
        setFetchedMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use provided members or fetched members (check for length, not just truthiness)
  const members = initialMembers?.length ? initialMembers : fetchedMembers;

  const filteredMembers = members.filter(member => {
    const searchLower = searchQuery.toLowerCase();
    const firstName = member.firstName?.toLowerCase() || '';
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();

    return firstName.includes(searchLower) || fullName.includes(searchLower);
  });

  const roleColors = {
    FOUNDER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    MODERATOR: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    LEADER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    COORDINATOR: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    MEMBER: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-flash-400/20 border border-flash-400/30">
              <Users className="text-flash-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Squad Members</h2>
              <p className="text-sm text-slate-400">{members.length} total members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:border-flash-500/70 focus:ring-2 focus:ring-flash-500/20 transition-all"
            />
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="h-24 bg-slate-800/50 rounded-xl border border-slate-700/50 animate-pulse"
                />
              ))}
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="space-y-3">
              {filteredMembers.map(member => (
                <MemberCard
                  key={member.id}
                  member={member}
                  currentUserId={currentUserId}
                  roleColors={roleColors}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">
                {searchQuery ? 'No members found' : 'No members yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member, currentUserId, roleColors }) {
  const isFriend = member.isFriend || false;
  const isCurrentUser = member.userId === currentUserId;

  // Privacy: Show first name only for non-friends
  const displayName = isFriend || isCurrentUser
    ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
    : member.firstName || 'Anonymous';

  const roleStyle = roleColors[member.role] || roleColors.MEMBER;
  const joinedAgo = member.joinedAt
    ? formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })
    : 'Recently';

  // Common divisions/groups
  const commonGroups = member.commonDivisions || [];

  return (
    <div className="group relative bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/70 transition-all">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {member.profileImage ? (
            <img
              src={member.profileImage}
              alt={displayName}
              className="w-14 h-14 rounded-full object-cover border-2 border-slate-600/50 group-hover:border-flash-400/50 transition-colors"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl border-2 border-slate-600/50 group-hover:border-flash-400/50 transition-colors">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Member Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-bold text-white text-base">{displayName}</h3>
            {isCurrentUser && (
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-flash-400/20 text-flash-300 border border-flash-400/30">
                You
              </span>
            )}
            {member.role && member.role !== 'MEMBER' && (
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${roleStyle}`}>
                {member.role.toLowerCase()}
              </span>
            )}
          </div>

          {/* Date Joined - Always visible */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Calendar size={14} />
            <span>Joined {joinedAgo}</span>
          </div>

          {/* Common Groups - Always visible */}
          {commonGroups.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
              <Shield size={14} className="flex-shrink-0" />
              <span className="text-slate-500">Groups in common:</span>
              <div className="flex flex-wrap gap-1">
                {commonGroups.map((group, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 text-xs font-medium border border-slate-600/50"
                  >
                    {group}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Friend-only info */}
          {(isFriend || isCurrentUser) && member.bio && (
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{member.bio}</p>
          )}
        </div>

        {/* Friend Actions - Only show for non-friends and not current user */}
        {!isFriend && !isCurrentUser && (
          <button
            className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
            title="Add Friend"
          >
            <UserPlus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
