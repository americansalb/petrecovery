'use client';

/**
 * SquadHeaderV2 - Modern, polished squad header
 * Midnight blue + orange theme with glassmorphism
 */

import { useState } from 'react';
import { Plus, Shield, Users, TrendingUp, MapPin, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SquadHeaderV2({
  squad,
  divisions,
  stats,
  onDivisionClick,
  membership,
  isDivisionPage = false,
  currentDivisionId = null,
}) {
  const router = useRouter();
  const cityName = squad.cityName || 'Unknown City';
  const state = squad.state || '';
  const currentDivision = divisions.find(d => d.id === currentDivisionId);

  const handleReportCase = () => {
    router.push('/cases/report');
  };

  const handleJoinSquad = async () => {
    try {
      const res = await fetch(`/api/rescue-squads/${squad.id}/join`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to join squad:', error);
    }
  };

  const squadPhoto = squad.photoUrl || null;
  const squadDescription = squad.description || `A dedicated community of volunteers protecting lost and found pets in ${cityName}.`;
  const zipCode = squad.zipCode || '';
  const customSlogan = squad.slogan || (state && zipCode ? `${cityName}, ${state} ${zipCode}` : `${cityName}${state ? ', ' + state : ''}`);
  const isAdmin = membership.role === 'ADMIN' || membership.role === 'MODERATOR';

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Ambient glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Squad Profile Section */}
        {!isDivisionPage && (
          <div className="mb-8 flex items-start gap-6">
            {/* Squad Photo */}
            <div className="relative group flex-shrink-0">
              <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-slate-700/50 backdrop-blur-sm">
                {squadPhoto ? (
                  <img
                    src={squadPhoto}
                    alt={`${cityName} Rescue Squad`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield size={48} className="text-slate-600" />
                  </div>
                )}
              </div>
              {isAdmin && (
                <button className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                  <Camera size={24} className="text-white" />
                </button>
              )}
            </div>

            {/* Squad Info */}
            <div className="flex-1">
              <h1 className="text-5xl font-bold tracking-tight mb-3">
                <span className="text-white">{cityName}</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-400"> Rescue Squad</span>
              </h1>
              <p className="text-lg text-slate-400 mb-3">
                {customSlogan}
              </p>
              <p className="text-base text-slate-500 leading-relaxed max-w-2xl">
                {squadDescription}
              </p>
            </div>
          </div>
        )}

        {/* Division Header (if on division page) */}
        {isDivisionPage && (
          <div className="mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <MapPin size={16} className="text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-400">Division</span>
            </div>
            <h1 className="text-5xl font-bold text-white tracking-tight">
              {currentDivision?.name || 'Division'}
            </h1>
            <p className="text-lg text-slate-400">
              Part of {cityName} Rescue Squad
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            value={stats.active}
            label="Active Cases"
            icon={<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            trend="urgent"
          />
          <StatCard
            value={stats.reunited}
            label="Reunited (30d)"
            icon={<div className="w-2 h-2 rounded-full bg-green-500" />}
            trend="positive"
          />
          <StatCard
            value={stats.members}
            label="Squad Members"
            icon={<Users size={16} className="text-slate-400" />}
          />
          <StatCard
            value={stats.onDuty}
            label="On Duty Now"
            icon={<div className="w-2 h-2 rounded-full bg-cyan-300" />}
            trend="active"
          />
        </div>

        {/* Division Chips & CTA */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Division Chips */}
          <div className="flex flex-wrap gap-2">
            {isDivisionPage ? (
              <>
                <button
                  onClick={() => router.push(`/rescue-squads/${squad.id}`)}
                  className="px-5 py-2.5 rounded-full text-sm font-medium bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-200"
                >
                  ← View Full Squad
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
              divisions.length > 0 && divisions.map(div => (
                <DivisionChip
                  key={div.id}
                  active={false}
                  onClick={() => onDivisionClick(div.id)}
                  label={div.name}
                  count={div.activeCaseCount}
                />
              ))
            )}
          </div>

          {/* Primary CTA */}
          {membership.isMember ? (
            <button
              onClick={handleReportCase}
              className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-400 text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Plus size={22} strokeWidth={2.5} />
                <span>Report Lost or Found Pet</span>
              </div>
            </button>
          ) : (
            <button
              onClick={handleJoinSquad}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/40 hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Shield size={22} />
                <span>Join This Squad</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon, trend }) {
  const trendColors = {
    urgent: 'border-red-500/20 bg-red-500/5',
    positive: 'border-green-500/20 bg-green-500/5',
    active: 'border-cyan-400/20 bg-cyan-400/5',
  };

  return (
    <div className={`p-5 rounded-2xl backdrop-blur-sm bg-slate-800/30 border ${trend ? trendColors[trend] : 'border-slate-700/30'} hover:bg-slate-800/50 transition-all duration-200`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-3xl font-bold text-white">{value}</span>
        {icon}
      </div>
      <p className="text-sm text-slate-400 font-medium">{label}</p>
    </div>
  );
}

function DivisionChip({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200
        ${active
          ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/25'
          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50 hover:border-cyan-500/50'
        }
      `}
    >
      {label}
      {count > 0 && (
        <span className={`ml-2 ${active ? 'text-slate-900/80' : 'text-cyan-400'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}
