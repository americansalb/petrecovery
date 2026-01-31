'use client';

/**
 * CompactHeader - Minimal header for Mission Control
 *
 * Shows pet name, status, time missing, and menu trigger.
 * Takes only 60px of vertical space.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/Toast';
import {
  ArrowLeft,
  MoreVertical,
  Clock,
  Share2,
  Info,
  Users,
  Settings,
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function CompactHeader({
  mission,
  timeMissing,
  isSearching = false,
  onExitSearch,
  onShowSighting
}) {
  const router = useRouter();
  const toast = useToast();
  const [showMenu, setShowMenu] = useState(false);

  const petName = mission?.petName || 'Unknown Pet';
  const petSpecies = mission?.petSpecies || 'PET';
  const petColor = mission?.petColor || '';
  const isResolved = mission?.status === 'RESOLVED';

  const handleBack = () => {
    if (isSearching && onExitSearch) {
      onExitSearch();
    } else {
      router.push('/dashboard');
    }
  };

  const handleShare = async () => {
    setShowMenu(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Help find ${petName}!`,
          text: `Please help us find our missing ${petSpecies.toLowerCase()}. Share this to spread the word!`,
          url: window.location.href
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy URL
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const menuItems = [
    { id: 'details', icon: Info, label: 'Pet Details', action: () => {} },
    { id: 'team', icon: Users, label: 'Search Team', action: () => {} },
    { id: 'share', icon: Share2, label: 'Share Case', action: handleShare },
    { id: 'settings', icon: Settings, label: 'Settings', action: () => {} },
  ];

  return (
    <>
      <header className={`h-[60px] px-4 flex items-center justify-between relative z-20 ${
        isSearching
          ? 'bg-red-600'
          : 'bg-slate-900/95 backdrop-blur border-b border-slate-800'
      }`}>
        {/* Left: Back button */}
        <button
          onClick={handleBack}
          className={`p-2 rounded-lg transition ${
            isSearching
              ? 'text-white/90 hover:bg-white/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Center: Pet info */}
        <div className="flex flex-col items-center flex-1 min-w-0 px-2">
          <div className="flex items-center gap-2">
            {isSearching && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
            <h1 className={`text-lg font-bold truncate ${
              isSearching ? 'text-white' : 'text-white'
            }`}>
              {isSearching ? 'LIVE SEARCH' : petName.toUpperCase()}
            </h1>
            {isResolved && (
              <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
            )}
          </div>
          {!isSearching && (
            <p className="text-xs text-slate-400 truncate">
              {petSpecies} {petColor && `• ${petColor}`}
            </p>
          )}
        </div>

        {/* Right: Time + Menu */}
        <div className="flex items-center gap-1">
          {/* Time badge */}
          {timeMissing && !isSearching && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              timeMissing.hours < 24
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Clock size={12} />
              <span>{timeMissing.hours < 24 ? `${timeMissing.hours}h` : `${Math.floor(timeMissing.hours / 24)}d`}</span>
            </div>
          )}

          {/* Sighting button when searching */}
          {isSearching && onShowSighting && (
            <button
              onClick={onShowSighting}
              className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition"
              title="Report Sighting"
            >
              <span className="text-lg">👁</span>
            </button>
          )}

          {/* Menu trigger */}
          {!isSearching && (
            <button
              onClick={() => setShowMenu(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <MoreVertical size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Slide-out Menu */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 border-l border-slate-800 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Menu Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Menu</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <nav className="p-2">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition text-left"
                >
                  <item.icon size={20} className="text-slate-400" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
