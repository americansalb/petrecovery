'use client';

/**
 * TeamTab - Effortless Actions
 *
 * Philosophy: ONE TAP = DONE
 * No extra clicks, no new tabs when possible, automatic everything
 */

import { useState, useEffect } from 'react';
import {
  Navigation,
  Users,
  Share2,
  Phone,
  MapPin,
  Clock,
  Check,
  ChevronRight,
  Zap,
} from 'lucide-react';

export default function TeamTab({
  team = [],
  mission,
  gpsPath = [],
  setGpsPath,
  isGPSTracking,
  setIsGPSTracking,
  showNotification,
  session,
}) {
  const [searchStats, setSearchStats] = useState({ distance: 0, duration: 0 });
  const [sharedTo, setSharedTo] = useState([]); // Track where user has shared

  // Calculate search stats when GPS path updates
  useEffect(() => {
    if (gpsPath.length < 2) {
      setSearchStats({ distance: 0, duration: 0 });
      return;
    }

    // Calculate total distance (rough approximation)
    let totalDistance = 0;
    for (let i = 1; i < gpsPath.length; i++) {
      const lat1 = gpsPath[i-1].lat;
      const lon1 = gpsPath[i-1].lng;
      const lat2 = gpsPath[i].lat;
      const lon2 = gpsPath[i].lng;
      // Haversine formula (simplified)
      const R = 3959; // miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }

    const duration = Math.round((gpsPath[gpsPath.length-1].timestamp - gpsPath[0].timestamp) / 60000);
    setSearchStats({ distance: totalDistance.toFixed(2), duration });
  }, [gpsPath]);

  // GPS Controls
  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      showNotification?.('error', 'GPS not available');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    showNotification?.('info', 'Tracking started!');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPath(prev => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }]);
      },
      () => {
        setIsGPSTracking(false);
        showNotification?.('error', 'GPS access denied');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    window._gpsWatchId = watchId;
  };

  const stopGPSTracking = () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
      window._gpsWatchId = null;
    }
    setIsGPSTracking(false);
    showNotification?.('success', `Saved! ${searchStats.distance} mi covered`);
  };

  // INSTANT SHARE - Uses native share sheet, falls back to clipboard
  const instantShare = async () => {
    const petName = mission?.petName || 'Missing Pet';
    const shareUrl = `${window.location.origin}/cases/${mission?.caseNumber || mission?.id}`;
    const shareText = `🚨 MISSING: ${petName}!\n${mission?.petBreed || mission?.petSpecies} last seen near ${mission?.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'unknown'}.\nPlease share! 🙏\n\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Missing: ${petName}`, text: shareText, url: shareUrl });
        setSharedTo(prev => [...new Set([...prev, 'native'])]);
        showNotification?.('success', 'Shared!');
      } catch (e) {
        if (e.name !== 'AbortError') {
          await copyAndNotify(shareText);
        }
      }
    } else {
      await copyAndNotify(shareText);
    }
  };

  const copyAndNotify = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSharedTo(prev => [...new Set([...prev, 'clipboard'])]);
      showNotification?.('success', 'Copied! Now paste anywhere');
    } catch {
      showNotification?.('error', 'Could not copy');
    }
  };

  // Quick actions data
  const petName = mission?.petName || 'Pet';
  const city = mission?.lastSeenAddress?.split(',')[1]?.trim() || '';

  // Pre-built shelter call script
  const callScript = `Hi, I'm looking for a missing ${mission?.petColor || ''} ${mission?.petBreed || mission?.petSpecies || 'pet'} named ${petName}. Lost near ${mission?.lastSeenAddress?.split(',').slice(0,2).join(',') || 'unknown area'} on ${mission?.lastSeenAt ? new Date(mission.lastSeenAt).toLocaleDateString() : 'recently'}.`;

  return (
    <div className="space-y-3 pb-20">

      {/* SEARCH - Big prominent card */}
      <div className={`rounded-2xl p-4 transition-all ${
        isGPSTracking
          ? 'bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30'
          : 'bg-slate-800 border border-slate-700'
      }`}>
        {!isGPSTracking ? (
          <button
            onClick={startGPSTracking}
            className="w-full flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Navigation size={28} className="text-purple-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-bold text-lg">Go Search</h3>
              <p className="text-slate-400 text-sm">Tap to start tracking your route</p>
            </div>
            <ChevronRight className="text-slate-500" />
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-white font-bold">Searching...</span>
              </div>
              <div className="text-white/80 text-sm font-medium">
                {searchStats.distance} mi • {searchStats.duration} min
              </div>
            </div>
            <button
              onClick={stopGPSTracking}
              className="w-full py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition"
            >
              <Check size={18} className="inline mr-2" />
              Done Searching
            </button>
          </div>
        )}

        {/* Show last search stats */}
        {!isGPSTracking && gpsPath.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 text-emerald-400 text-sm">
            <Check size={16} />
            <span>Last search: {searchStats.distance} mi in {searchStats.duration} min</span>
          </div>
        )}
      </div>

      {/* INSTANT SHARE - One tap */}
      <button
        onClick={instantShare}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-blue-500/20"
      >
        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
          <Share2 size={28} className="text-white" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-white font-bold text-lg">Share Now</h3>
          <p className="text-white/70 text-sm">One tap to spread the word</p>
        </div>
        {sharedTo.length > 0 && (
          <div className="bg-white/20 px-2 py-1 rounded-lg text-white text-xs font-medium">
            ✓ Shared
          </div>
        )}
      </button>

      {/* CALL SHELTERS - Tap to call with script */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Phone size={24} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Call Shelters</h3>
            <p className="text-slate-400 text-xs">Script ready - just tap and read</p>
          </div>
        </div>

        {/* Call script preview */}
        <div className="bg-slate-900/50 rounded-xl p-3 mb-3 text-sm text-slate-300 leading-relaxed">
          "{callScript}"
        </div>

        {/* Shelter search */}
        <a
          href={`tel:311`}
          className="block w-full py-3 bg-emerald-500 text-white font-bold rounded-xl text-center hover:bg-emerald-400 transition mb-2"
        >
          <Phone size={16} className="inline mr-2" />
          Call 311 (City Services)
        </a>
        <a
          href={`https://www.google.com/search?q=animal+shelter+${encodeURIComponent(city)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2.5 bg-slate-700 text-white font-medium rounded-xl text-center hover:bg-slate-600 transition text-sm"
        >
          Find Local Shelters →
        </a>
      </div>

      {/* QUICK LINKS - Horizontal scroll */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          Quick Check Sites
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {[
            { name: 'Nextdoor', url: 'https://nextdoor.com', color: 'bg-green-600' },
            { name: 'Pawboost', url: 'https://pawboost.com', color: 'bg-orange-500' },
            { name: 'Facebook', url: 'https://facebook.com/search/posts?q=lost%20pet', color: 'bg-blue-600' },
            { name: 'Craigslist', url: 'https://craigslist.org/search/pet', color: 'bg-purple-600' },
          ].map(site => (
            <a
              key={site.name}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${site.color} px-4 py-2 rounded-lg text-white font-medium text-sm whitespace-nowrap hover:opacity-90 transition`}
            >
              {site.name}
            </a>
          ))}
        </div>
      </div>

      {/* TEAM */}
      {team.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Users size={18} className="text-flash-400" />
            Team ({team.length})
          </h3>
          <div className="flex -space-x-2">
            {team.slice(0, 8).map((member, i) => (
              <div
                key={member.id}
                className="w-10 h-10 rounded-full bg-flash-500/20 border-2 border-slate-800 flex items-center justify-center text-flash-400 font-bold text-sm"
                title={member.name}
              >
                {member.firstName?.[0]}{member.lastName?.[0] || ''}
              </div>
            ))}
            {team.length > 8 && (
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                +{team.length - 8}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
