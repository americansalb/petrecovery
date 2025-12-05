'use client';

/**
 * TeamTab - Action-Oriented Team Coordination
 *
 * Every button DOES something - no useless checkboxes!
 * 1. Search - GPS tracking with map visualization
 * 2. Spread the Word - Direct share buttons for each platform
 * 3. Monitor Online - Direct links to search sites
 * 4. Check Shelters - Tap-to-call shelter list
 */

import { useState } from 'react';
import {
  Navigation,
  Users,
  Share2,
  Search,
  Building2,
  Globe,
  Check,
  ExternalLink,
  Phone,
  Facebook,
  Twitter,
  Copy,
  FileText,
  MapPin,
  Clock,
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
  onNavigateToMap,
}) {
  const [expandedSection, setExpandedSection] = useState(null);

  // ============================================
  // GPS TRACKING
  // ============================================
  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      showNotification?.('error', 'GPS not available on this device');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    showNotification?.('info', 'GPS tracking started!');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPath(prev => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }]);
      },
      (error) => {
        console.error('GPS error:', error);
        setIsGPSTracking(false);
        showNotification?.('error', 'GPS access denied. Check your permissions.');
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
    if (gpsPath.length > 0) {
      showNotification?.('success', `Search saved! ${gpsPath.length} points recorded.`);
    }
  };

  // ============================================
  // SHARING ACTIONS - Each does something specific
  // ============================================
  const petName = mission?.petName || 'Missing Pet';
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cases/${mission?.caseNumber || mission?.id}`
    : '';
  const shareText = `Help find ${petName}! ${mission?.petBreed || mission?.petSpecies || 'Pet'} missing near ${mission?.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'unknown location'}. Please share!`;

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400');
    showNotification?.('success', 'Opening Facebook...');
  };

  const shareToTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400');
    showNotification?.('success', 'Opening Twitter...');
  };

  const shareToNextdoor = () => {
    window.open('https://nextdoor.com/news_feed/', '_blank');
    showNotification?.('info', 'Post on Nextdoor with the copied message!');
    copyMessage();
  };

  const copyMessage = async () => {
    const fullMessage = `${shareText}\n\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(fullMessage);
      showNotification?.('success', 'Message copied! Paste anywhere.');
    } catch {
      showNotification?.('error', 'Could not copy. Try again.');
    }
  };

  const downloadFlyer = () => {
    // Navigate to flyer page or generate
    window.open(`/cases/${mission?.caseNumber || mission?.id}/flyer`, '_blank');
    showNotification?.('info', 'Opening flyer generator...');
  };

  // ============================================
  // ONLINE MONITORING - Direct links
  // ============================================
  const cityState = mission?.lastSeenAddress?.split(',').slice(-2).join(',').trim() || '';
  const searchQuery = encodeURIComponent(`${mission?.petSpecies || 'pet'} ${mission?.petColor || ''} ${cityState}`);

  const onlineLinks = [
    { name: 'Pawboost', url: 'https://www.pawboost.com/lost-found-pets', icon: '🐾' },
    { name: 'Petfinder Found', url: 'https://www.petfinder.com/search/pets-for-adoption/', icon: '🔍' },
    { name: 'Craigslist Pets', url: `https://craigslist.org/search/pet?query=${searchQuery}`, icon: '📋' },
    { name: 'Nextdoor', url: 'https://nextdoor.com/news_feed/?filter=lost_and_found', icon: '🏘️' },
    { name: 'Facebook Lost Pets', url: 'https://www.facebook.com/search/groups/?q=lost%20pets', icon: '👥' },
  ];

  // ============================================
  // SHELTER INFO - Would be dynamic in production
  // ============================================
  const shelterSearchUrl = `https://www.google.com/search?q=animal+shelters+near+${encodeURIComponent(mission?.lastSeenAddress || '')}`;

  return (
    <div className="space-y-4 pb-20">

      {/* ============================================ */}
      {/* SECTION 1: SEARCH THE AREA */}
      {/* ============================================ */}
      <div className={`rounded-xl border-2 overflow-hidden transition-all ${
        isGPSTracking
          ? 'bg-purple-500/20 border-purple-500'
          : 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50'
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${isGPSTracking ? 'bg-purple-500' : 'bg-purple-500/20'}`}>
              <Navigation size={20} className={isGPSTracking ? 'text-white' : 'text-purple-400'} />
            </div>
            <div>
              <h3 className="text-white font-bold">Search the Area</h3>
              <p className="text-slate-400 text-xs">Track your path on the map</p>
            </div>
          </div>

          {!isGPSTracking ? (
            <button
              onClick={startGPSTracking}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition shadow-lg"
            >
              <Navigation size={18} className="inline mr-2" />
              Start Tracking My Search
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-purple-500/30 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  <span className="text-purple-200 text-sm font-medium">Recording...</span>
                </div>
                <span className="text-purple-300 font-bold">{gpsPath.length} points</span>
              </div>
              <button
                onClick={stopGPSTracking}
                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition"
              >
                <Check size={18} className="inline mr-2" />
                Done - Save My Search
              </button>
            </div>
          )}

          {gpsPath.length > 0 && !isGPSTracking && (
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="text-emerald-400 text-sm font-medium">
                ✓ Last search: {gpsPath.length} GPS points recorded
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 2: SPREAD THE WORD */}
      {/* ============================================ */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'spread' ? null : 'spread')}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Share2 size={20} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold">Spread the Word</h3>
            <p className="text-slate-400 text-xs">Share on social media & beyond</p>
          </div>
          <div className={`text-slate-500 transition-transform ${expandedSection === 'spread' ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSection === 'spread' && (
          <div className="px-4 pb-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={shareToFacebook}
                className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white font-semibold rounded-lg hover:opacity-90 transition"
              >
                <Facebook size={18} />
                Facebook
              </button>
              <button
                onClick={shareToTwitter}
                className="flex items-center justify-center gap-2 py-3 bg-[#1DA1F2] text-white font-semibold rounded-lg hover:opacity-90 transition"
              >
                <Twitter size={18} />
                Twitter
              </button>
              <button
                onClick={shareToNextdoor}
                className="flex items-center justify-center gap-2 py-3 bg-[#00B246] text-white font-semibold rounded-lg hover:opacity-90 transition"
              >
                🏘️ Nextdoor
              </button>
              <button
                onClick={copyMessage}
                className="flex items-center justify-center gap-2 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition"
              >
                <Copy size={18} />
                Copy Text
              </button>
            </div>
            <button
              onClick={downloadFlyer}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition"
            >
              <FileText size={18} />
              Download Printable Flyer
            </button>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* SECTION 3: MONITOR ONLINE */}
      {/* ============================================ */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'online' ? null : 'online')}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Globe size={20} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold">Monitor Online</h3>
            <p className="text-slate-400 text-xs">Check if someone found them</p>
          </div>
          <div className={`text-slate-500 transition-transform ${expandedSection === 'online' ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSection === 'online' && (
          <div className="px-4 pb-4 space-y-2">
            {onlineLinks.map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition group"
              >
                <span className="text-xl">{link.icon}</span>
                <span className="text-white font-medium flex-1">{link.name}</span>
                <ExternalLink size={16} className="text-slate-500 group-hover:text-amber-400" />
              </a>
            ))}
            <p className="text-slate-500 text-xs text-center pt-2">
              Tip: Check these sites daily for "found pet" posts
            </p>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* SECTION 4: CHECK SHELTERS */}
      {/* ============================================ */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'shelters' ? null : 'shelters')}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Building2 size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold">Check Shelters</h3>
            <p className="text-slate-400 text-xs">Call or visit local shelters</p>
          </div>
          <div className={`text-slate-500 transition-transform ${expandedSection === 'shelters' ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </button>

        {expandedSection === 'shelters' && (
          <div className="px-4 pb-4 space-y-3">
            <a
              href={shelterSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-400 transition"
            >
              <Search size={18} />
              Find Shelters Near {mission?.lastSeenAddress?.split(',')[1]?.trim() || 'You'}
            </a>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-slate-300 text-sm mb-2 font-medium">When you call:</p>
              <ul className="text-slate-400 text-sm space-y-1">
                <li>• Describe: <span className="text-white">{mission?.petColor} {mission?.petBreed || mission?.petSpecies}</span></li>
                <li>• Name: <span className="text-white">{petName}</span></li>
                <li>• Missing since: <span className="text-white">{mission?.lastSeenAt ? new Date(mission.lastSeenAt).toLocaleDateString() : 'Unknown'}</span></li>
                <li>• Last seen: <span className="text-white">{mission?.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'Unknown'}</span></li>
              </ul>
            </div>

            <p className="text-slate-500 text-xs text-center">
              Tip: Visit in person too - photos don't always match
            </p>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* TEAM MEMBERS */}
      {/* ============================================ */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Users size={18} className="text-flash-400" />
          Search Team ({team.length})
        </h3>
        {team.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-2">
            Share this case to get more helpers!
          </p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold text-sm">
                  {member.firstName?.[0]}{member.lastName?.[0] || ''}
                </div>
                <span className="text-white text-sm flex-1">{member.name}</span>
                {member.isActive && (
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
