'use client';

/**
 * TeamPanel - Squad member management and coordination
 *
 * Features:
 * - View active team members
 * - See who's currently searching
 * - Join/leave mission
 * - Invite others to help
 */

import { useState } from 'react';
import {
  Users,
  UserPlus,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  Share2,
  Phone,
  MessageCircle,
  Navigation,
  Star
} from 'lucide-react';

export default function TeamPanel({
  team = [],
  activeParticipants = [],
  isDeployed = false,
  isOwner = false,
  onJoinMission,
  onInvite,
  isJoining = false,
}) {
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'searching'

  // Filter team members
  const filteredTeam = team.filter(member => {
    if (filter === 'active') return member.isActive;
    if (filter === 'searching') return member.isSearching;
    return true;
  });

  const activeCount = team.filter(m => m.isActive).length;
  const searchingCount = team.filter(m => m.isSearching).length;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Help us search!',
          text: 'Join our pet search team and help bring them home!',
          url: window.location.href
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Header Stats */}
      <div className="p-4 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-amber-400" />
            Search Team
          </h2>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition"
          >
            <Share2 size={14} />
            Invite
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{team.length}</p>
            <p className="text-xs text-slate-400">Total Members</p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            <p className="text-xs text-emerald-400/70">Active Now</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-400">{searchingCount}</p>
            <p className="text-xs text-amber-400/70">Searching</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-3 border-b border-slate-800">
        {[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'searching', label: 'Searching' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Team List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTeam.length === 0 ? (
          <div className="text-center py-8">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">No team members yet</p>
            <p className="text-slate-600 text-sm mt-1">Share the link to invite helpers</p>
          </div>
        ) : (
          filteredTeam.map(member => (
            <div
              key={member.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center gap-3"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                  {member.firstName?.[0] || member.name?.[0] || '?'}
                </div>
                {member.isActive && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">
                    {member.name || `${member.firstName} ${member.lastName || ''}`}
                  </p>
                  {member.isOwner && (
                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded">
                      OWNER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {member.isSearching ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Navigation size={10} className="animate-pulse" />
                      Searching now
                    </span>
                  ) : member.isActive ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Circle size={8} fill="currentColor" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={10} />
                      Last active {member.lastActive || 'recently'}
                    </span>
                  )}
                  {member.points > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-400/70">
                      <Star size={10} />
                      {member.points} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Message"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Join/Status Footer */}
      {!isDeployed && !isOwner && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onJoinMission}
            disabled={isJoining}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {isJoining ? 'Joining...' : 'Join Search Team'}
          </button>
        </div>
      )}

      {isDeployed && (
        <div className="p-4 border-t border-slate-800 bg-emerald-500/10">
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle size={18} />
            <span className="font-medium">You're on the team!</span>
          </div>
        </div>
      )}
    </div>
  );
}
