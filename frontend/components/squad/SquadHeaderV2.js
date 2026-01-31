'use client';

/**
 * SquadHeaderV2 - Modern, polished squad header
 * Yellow, white, midnight blue color scheme
 */

import { useState } from 'react';
import { Shield, Users, MapPin, Camera, Target, Heart, Radio } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import { useRouter } from 'next/navigation';
import PhotoUploadModal from './PhotoUploadModal';
import MembersModal from './MembersModal';

export default function SquadHeaderV2({
  squad,
  divisions,
  stats,
  onDivisionClick,
  membership,
  isDivisionPage = false,
  currentDivisionId = null,
  onRefresh,
}) {
  const router = useRouter();
  const toast = useToast();
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const cityName = squad.cityName || 'Unknown City';
  const state = squad.state || '';
  const currentDivision = divisions.find(d => d.id === currentDivisionId);

  const handleJoinSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squad.id}/join`, {
        method: 'POST',
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Failed to join squad:', error);
      toast.error('Failed to join rescue force.');
    }
  };

  const squadPhoto = squad.photoUrl || null;
  const squadDescription = squad.description || `A dedicated community of volunteers protecting lost and found pets in ${cityName}.`;
  const zipCode = squad.zipCode || '';
  const customSlogan = squad.slogan || (state && zipCode ? `${cityName}, ${state} ${zipCode}` : `${cityName}${state ? ', ' + state : ''}`);
  const isAdmin = membership.role === 'ADMIN' || membership.role === 'MODERATOR' || membership.role === 'FOUNDER';

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient glow effects - yellow theme */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-flash-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-flash-400/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* Squad Profile Section */}
        {!isDivisionPage && (
          <div className="mb-6 flex items-start gap-6">
            {/* Squad Photo */}
            <div className="relative group flex-shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-flash-500/30 backdrop-blur-sm">
                {squadPhoto ? (
                  <img
                    src={squadPhoto}
                    alt={`${cityName} Rescue Force`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-flash-500/20 to-flash-400/10">
                    <Shield size={40} className="text-flash-400" />
                  </div>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowPhotoUpload(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                >
                  <Camera size={24} className="text-white" />
                </button>
              )}
            </div>

            {/* Squad Info */}
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
                <span className="text-white">{cityName}</span>
                <span className="text-flash-400"> Rescue Force</span>
              </h1>
              <p className="text-base text-slate-400 mb-2">
                {customSlogan}
              </p>
              <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                {squadDescription}
              </p>
            </div>
          </div>
        )}

        {/* Division Header (if on division page) */}
        {isDivisionPage && (
          <div className="mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-flash-500/10 border border-flash-500/20">
              <MapPin size={14} className="text-flash-400" />
              <span className="text-xs font-semibold text-flash-400">Division</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {currentDivision?.name || 'Division'}
            </h1>
            <p className="text-base text-slate-400">
              Part of {cityName} Rescue Force
            </p>
          </div>
        )}

        {/* Stats Bar with Icons */}
        <div className="flex items-center gap-4 sm:gap-6 mb-5 flex-wrap">
          <StatBadge
            icon={Target}
            value={stats.active}
            label="Active"
            color="text-red-400"
            bgColor="bg-red-500/10"
            pulse
          />
          <StatBadge
            icon={Heart}
            value={stats.reunited}
            label="Reunited"
            color="text-green-400"
            bgColor="bg-green-500/10"
          />
          <button
            onClick={() => setShowMembers(true)}
            className="group"
          >
            <StatBadge
              icon={Users}
              value={stats.members}
              label="Members"
              color="text-flash-400"
              bgColor="bg-flash-500/10"
              hoverable
            />
          </button>
          <StatBadge
            icon={Radio}
            value={stats.onDuty}
            label="On Duty"
            color="text-flash-300"
            bgColor="bg-flash-400/10"
          />
        </div>

        {/* Division Chips */}
        <div className="flex flex-wrap gap-2">
          {isDivisionPage ? (
            <>
              <button
                onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                className="px-4 py-2 rounded-full text-sm font-medium bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-200"
              >
                ← View Full Rescue Force
              </button>
              <DivisionChip active={true} label={currentDivision?.name || 'Division'} />
              {divisions.filter(d => d.id !== currentDivisionId).map(div => (
                <DivisionChip
                  key={div.id}
                  active={false}
                  onClick={() => router.push(`/rescue-squads/${squad.id}/divisions/${div.id}`)}
                  label={div.name}
                />
              ))}
            </>
          ) : (
            <>
              {divisions.length > 0 && divisions.map(div => (
                <DivisionChip
                  key={div.id}
                  active={false}
                  onClick={() => onDivisionClick(div.id)}
                  label={div.name}
                  count={div.activeCaseCount}
                />
              ))}
              {!membership.isMember && (
                <button
                  onClick={handleJoinSquad}
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 text-sm font-bold shadow-lg shadow-flash-500/25 hover:shadow-xl hover:shadow-flash-500/40 hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={16} />
                    <span>Join This Rescue Force</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={showPhotoUpload}
        onClose={() => setShowPhotoUpload(false)}
        onUpload={(url) => {
          console.log('Photo uploaded:', url);
        }}
        squadId={squad.id}
      />

      {/* Members Modal */}
      <MembersModal
        isOpen={showMembers}
        onClose={() => setShowMembers(false)}
        squadId={squad.id}
        currentUserId={membership?.userId}
      />
    </div>
  );
}

function StatBadge({ icon: Icon, value, label, color, bgColor, pulse, hoverable }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgColor} border border-slate-700/30 ${hoverable ? 'group-hover:border-flash-500/50 transition-colors' : ''}`}>
      <Icon size={14} className={`${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-white font-bold text-sm">{value}</span>
      <span className={`text-slate-400 text-sm ${hoverable ? 'group-hover:text-slate-300' : ''}`}>{label}</span>
    </div>
  );
}

function DivisionChip({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
        ${active
          ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900 shadow-lg shadow-flash-500/25'
          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50 hover:border-flash-500/50'
        }
      `}
    >
      {label}
      {count > 0 && (
        <span className={`ml-2 ${active ? 'text-slate-900/70' : 'text-flash-400'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}
