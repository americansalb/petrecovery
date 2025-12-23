'use client';

/**
 * ActionsPanel - Practical recovery actions
 *
 * Features:
 * - Contact shelters checklist
 * - Share/flyer distribution
 * - Attracting stations
 * - Key phone numbers
 */

import { useState } from 'react';
import {
  Phone,
  Printer,
  Share2,
  MapPin,
  CheckCircle2,
  Circle,
  ExternalLink,
  Building2,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';

// Sample shelters - in production, fetch based on location
const NEARBY_SHELTERS = [
  { id: '1', name: 'City Animal Shelter', distance: '2.1 mi', phone: '(555) 123-4567', type: 'Municipal' },
  { id: '2', name: 'Humane Society', distance: '3.4 mi', phone: '(555) 234-5678', type: 'Non-profit' },
  { id: '3', name: 'Pet Rescue League', distance: '5.2 mi', phone: '(555) 345-6789', type: 'Rescue' },
  { id: '4', name: 'County Animal Control', distance: '6.8 mi', phone: '(555) 456-7890', type: 'Government' },
];

const SHARE_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
  { id: 'nextdoor', name: 'Nextdoor', icon: '🏘️', color: 'bg-green-600' },
  { id: 'twitter', name: 'X/Twitter', icon: '🐦', color: 'bg-slate-700' },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-pink-600' },
];

export default function ActionsPanel({
  mission,
  completedActions = [],
  onActionComplete,
  onShare,
  onDownloadFlyer,
  onCallShelter,
}) {
  const [calledShelters, setCalledShelters] = useState(new Set());
  const [copiedPhone, setCopiedPhone] = useState(null);

  const handleCallShelter = (shelter) => {
    // Open phone app
    window.location.href = `tel:${shelter.phone.replace(/[^\d]/g, '')}`;
    // Mark as called
    setCalledShelters(prev => new Set([...prev, shelter.id]));
    onCallShelter?.(shelter);
  };

  const handleCopyPhone = async (shelter) => {
    await navigator.clipboard.writeText(shelter.phone);
    setCopiedPhone(shelter.id);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleShare = (platform) => {
    onShare?.(platform);
    // In production, open share dialog for specific platform
    if (navigator.share) {
      navigator.share({
        title: `Help find ${mission?.petName || 'missing pet'}!`,
        text: `Please help us find our missing pet. Share to spread the word!`,
        url: window.location.href
      }).catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
      {/* Share Section */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Share2 size={16} className="text-blue-400" />
          Spread the Word
        </h2>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {SHARE_PLATFORMS.map(platform => (
            <button
              key={platform.id}
              onClick={() => handleShare(platform.id)}
              className={`p-3 rounded-xl ${platform.color} flex flex-col items-center gap-1 active:scale-95 transition`}
            >
              <span className="text-xl">{platform.icon}</span>
              <span className="text-[10px] text-white/80">{platform.name}</span>
            </button>
          ))}
        </div>

        {/* Download Flyer */}
        <button
          onClick={onDownloadFlyer}
          className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition flex items-center justify-center gap-2"
        >
          <Printer size={18} className="text-amber-400" />
          <span className="text-white font-medium">Download & Print Flyers</span>
        </button>
      </div>

      {/* Shelters Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 size={16} className="text-emerald-400" />
            Nearby Shelters
          </h2>
          <span className="text-xs text-slate-500">
            {calledShelters.size}/{NEARBY_SHELTERS.length} contacted
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Call these shelters to report your missing pet. They may have already found them!
        </p>

        <div className="space-y-2">
          {NEARBY_SHELTERS.map(shelter => {
            const called = calledShelters.has(shelter.id);

            return (
              <div
                key={shelter.id}
                className={`rounded-xl border p-3 transition ${
                  called
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900/50 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status */}
                  <div className="mt-0.5">
                    {called ? (
                      <CheckCircle2 size={20} className="text-emerald-400" />
                    ) : (
                      <Circle size={20} className="text-slate-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${called ? 'text-emerald-400' : 'text-white'}`}>
                        {shelter.name}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {shelter.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {shelter.distance} away
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyPhone(shelter)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                      title="Copy phone number"
                    >
                      {copiedPhone === shelter.id ? (
                        <Check size={16} className="text-emerald-400" />
                      ) : (
                        <Copy size={16} className="text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCallShelter(shelter)}
                      className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition"
                    >
                      <Phone size={16} className="text-emerald-400" />
                    </button>
                  </div>
                </div>

                {/* Phone number */}
                <p className="text-sm text-slate-400 mt-2 ml-8 font-mono">
                  {shelter.phone}
                </p>
              </div>
            );
          })}
        </div>

        {/* More resources link */}
        <button className="w-full mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition flex items-center justify-center gap-2 text-sm text-slate-400">
          <MapPin size={16} />
          <span>Find more shelters nearby</span>
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Attracting Tips Teaser */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
          <h3 className="font-semibold text-amber-400 mb-1">Set Up an Attracting Station</h3>
          <p className="text-xs text-slate-400 mb-3">
            Place familiar items like their bed, your worn clothing, and food near where they were last seen.
          </p>
          <div className="flex items-center gap-2 text-xs text-amber-400/80">
            <span>Learn more in Tips tab</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}
