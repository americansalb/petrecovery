'use client';

/**
 * Public Case Page - Pet's Landing Page
 *
 * THE central hub for a lost pet's recovery campaign.
 * Designed for strangers clicking shared links from social media.
 * Drives actions: sighting reports, sharing, joining search, crowdfunding ads.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MapPin, Clock, Share2, MessageCircle, Eye, Search,
  Heart, ArrowRight, Phone, Mail, ChevronRight,
  Loader2, AlertCircle, X, Users, Building2,
  Camera, Printer, Facebook, Twitter, Copy, Check,
  Megaphone, TrendingUp, ExternalLink
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const PetMap = dynamic(() => import('@/app/components/PetMap'), { ssr: false });

// Format time ago
const formatTimeAgo = (date) => {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString();
};

export default function PublicCasePage() {
  const params = useParams();
  const router = useRouter();
  const caseNumber = params.caseNumber;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSightingModal, setShowSightingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!caseNumber) return;

    const fetchCase = async () => {
      try {
        const res = await fetch(`/api/public/missions/${caseNumber}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Case not found');
          } else {
            setError('Failed to load case');
          }
          return;
        }
        const data = await res.json();
        setCaseData(data);
      } catch (err) {
        setError('Failed to load case');
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [caseNumber]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Help find ${caseData?.petName || 'this pet'}! Last seen near ${caseData?.lastSeenAddress || 'unknown location'}.`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Help Find ${caseData?.petName}!`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      setShowShareModal(true);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-midnight-50 to-white">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-midnight-400 animate-spin mx-auto mb-4" />
            <p className="text-midnight-500 text-lg">Loading case details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-midnight-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <AlertCircle className="w-16 h-16 text-midnight-300 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-midnight-900 mb-3">{error}</h1>
            <p className="text-midnight-500 mb-8">This case may have been resolved or removed.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white px-6 py-3 rounded-xl font-semibold transition"
            >
              Go to Homepage
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const petName = caseData?.petName || 'Unknown';
  const petSpecies = caseData?.petSpecies || 'Pet';
  const isLost = caseData?.reportType === 'LOST';

  // Mock ad fund data (would come from API)
  const adFund = {
    raised: caseData?.adFundRaised || 45,
    goal: caseData?.adFundGoal || 100,
    contributors: caseData?.adFundContributors || 3
  };
  const fundProgress = Math.min((adFund.raised / adFund.goal) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-50 to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-rose-500 to-rose-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            {/* Pet Photo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full lg:w-80 flex-shrink-0"
            >
              <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
                {caseData?.petPhotoUrl ? (
                  <img
                    src={caseData.petPhotoUrl}
                    alt={petName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-rose-400 flex items-center justify-center">
                    <Search className="w-24 h-24 text-white/50" />
                  </div>
                )}
                {caseData?.isUrgent && (
                  <div className="absolute top-4 left-4 px-4 py-2 bg-flash-400 text-midnight-900 text-sm font-bold rounded-full shadow-lg">
                    URGENT
                  </div>
                )}
              </div>
            </motion.div>

            {/* Pet Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                <span className="w-2 h-2 bg-flash-400 rounded-full animate-pulse" />
                <span className="font-semibold text-sm uppercase tracking-wide">
                  {isLost ? 'Lost' : 'Found'} {petSpecies}
                </span>
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold mb-4">Help Find {petName}</h1>

              <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-6">
                {caseData?.petBreed && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium">{caseData.petBreed}</span>
                )}
                {caseData?.petColor && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium capitalize">{caseData.petColor}</span>
                )}
                {caseData?.petSize && (
                  <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium capitalize">{caseData.petSize.toLowerCase()}</span>
                )}
              </div>

              {caseData?.petDescription && (
                <p className="text-white/90 text-lg max-w-xl mb-6">{caseData.petDescription}</p>
              )}

              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact Owner
                </button>
                <div className="text-white/60 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Missing {formatTimeAgo(caseData?.lastSeenAt)}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Location & Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Last Seen Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-lg p-6 border border-midnight-100"
            >
              <h2 className="text-lg font-bold text-midnight-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" />
                Last Seen Location
              </h2>

              <div className="mb-4">
                <p className="text-midnight-900 font-medium text-lg">{caseData?.lastSeenAddress || 'Unknown location'}</p>
                <p className="text-midnight-500 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4" />
                  {formatTimeAgo(caseData?.lastSeenAt)}
                </p>
              </div>

              {/* Map */}
              {caseData?.lastSeenLatitude && caseData?.lastSeenLongitude && (
                <div className="rounded-2xl overflow-hidden border border-midnight-100">
                  <PetMap
                    center={[caseData.lastSeenLatitude, caseData.lastSeenLongitude]}
                    zoom={14}
                    height="300px"
                    markers={[
                      {
                        position: [caseData.lastSeenLatitude, caseData.lastSeenLongitude],
                        type: 'lastSeen',
                        popup: `Last seen: ${caseData.lastSeenAddress || 'Here'}`
                      }
                    ]}
                  />
                </div>
              )}
            </motion.div>

            {/* Campaign Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-4 gap-4"
            >
              <div className="bg-white rounded-2xl p-4 text-center shadow border border-midnight-100">
                <p className="text-2xl font-bold text-midnight-900">{caseData?.viewCount || 0}</p>
                <p className="text-xs text-midnight-500">Views</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow border border-midnight-100">
                <p className="text-2xl font-bold text-midnight-900">{caseData?.shareCount || 0}</p>
                <p className="text-xs text-midnight-500">Shares</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow border border-midnight-100">
                <p className="text-2xl font-bold text-midnight-900">{caseData?.activeSearchers || 0}</p>
                <p className="text-xs text-midnight-500">Helpers</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow border border-midnight-100">
                <p className="text-2xl font-bold text-emerald-600">${adFund.raised}</p>
                <p className="text-xs text-midnight-500">Ad Fund</p>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-4">
            {/* PRIMARY: Report Sighting */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowSightingModal(true)}
              className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl p-5 text-left shadow-lg shadow-rose-200 transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Eye className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">I've Seen {petName}</p>
                  <p className="text-rose-100 text-sm">Report a sighting</p>
                </div>
                <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition" />
              </div>
            </motion.button>

            {/* SHARE: Spread the Word */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={handleNativeShare}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl p-5 text-left shadow-lg shadow-blue-200 transition group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Share2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">Share This Alert</p>
                  <p className="text-blue-100 text-sm">Help spread the word</p>
                </div>
                <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition" />
              </div>
            </motion.button>

            {/* JOIN: Search Party */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Link
                href={`/mission-control?mission=${caseNumber}`}
                className="block w-full bg-midnight-900 hover:bg-midnight-800 text-white rounded-2xl p-5 shadow-lg transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-flash-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                    <Users className="w-6 h-6 text-midnight-900" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">Join Search Party</p>
                    <p className="text-midnight-300 text-sm">Coordinate with others</p>
                  </div>
                  <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                </div>
              </Link>
            </motion.div>

            {/* PRINT: Flyers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link
                href={`/mission-control?mission=${caseNumber}&tab=flyer`}
                className="block w-full bg-white hover:bg-midnight-50 text-midnight-900 rounded-2xl p-5 border-2 border-midnight-200 shadow transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                    <Printer className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">Print Flyers</p>
                    <p className="text-midnight-500 text-sm">Post in your neighborhood</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-midnight-300 group-hover:text-midnight-600 group-hover:translate-x-1 transition" />
                </div>
              </Link>
            </motion.div>

            {/* FUND: Chip in for Ads */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link
                href={`/mission-control?mission=${caseNumber}&tab=boost`}
                className="block w-full bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-midnight-900 rounded-2xl p-5 border-2 border-emerald-200 shadow transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">Chip in for Ads</p>
                    <p className="text-midnight-500 text-sm">{adFund.contributors} neighbors contributed</p>
                    {/* Progress bar */}
                    <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${fundProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">${adFund.raised} of ${adFund.goal} goal</p>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* SHELTERS: Check Nearby */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Link
                href={`/shelters?location=${encodeURIComponent(caseData?.lastSeenAddress || '')}`}
                className="block w-full bg-white hover:bg-midnight-50 text-midnight-900 rounded-2xl p-5 border border-midnight-200 shadow transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                    <Building2 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">Check Nearby Shelters</p>
                    <p className="text-midnight-500 text-sm">Pets sometimes end up here</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-midnight-300 group-hover:text-midnight-600 group-hover:translate-x-1 transition" />
                </div>
              </Link>
            </motion.div>

            {/* Case Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-midnight-50 rounded-2xl p-4 text-center"
            >
              <p className="text-sm text-midnight-500">
                Case #{caseData?.missionNumber}
              </p>
              <p className="text-xs text-midnight-400 mt-1">
                Reported {new Date(caseData?.createdAt).toLocaleDateString()}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Owner Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
          >
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-midnight-900 mb-6">Contact Owner</h2>

            {caseData?.contact ? (
              <div className="space-y-4">
                {caseData.contact.name && (
                  <p className="text-midnight-600">
                    <span className="font-semibold text-midnight-900">{caseData.contact.name}</span> is looking for {petName}.
                  </p>
                )}

                {caseData.contact.phone && (
                  <a
                    href={`tel:${caseData.contact.phone}`}
                    className="flex items-center gap-4 p-4 bg-midnight-50 rounded-xl hover:bg-midnight-100 transition"
                  >
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-midnight-900">Call</p>
                      <p className="text-midnight-500">{caseData.contact.phone}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-midnight-400 ml-auto" />
                  </a>
                )}

                {caseData.contact.email && (
                  <a
                    href={`mailto:${caseData.contact.email}?subject=Regarding ${petName} - Case ${caseNumber}`}
                    className="flex items-center gap-4 p-4 bg-midnight-50 rounded-xl hover:bg-midnight-100 transition"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-midnight-900">Email</p>
                      <p className="text-midnight-500">{caseData.contact.email}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-midnight-400 ml-auto" />
                  </a>
                )}

                <p className="text-xs text-midnight-400 mt-4 p-3 bg-amber-50 rounded-lg">
                  {caseData.contact.disclaimer}
                </p>
              </div>
            ) : (
              <p className="text-midnight-500">Contact information not available.</p>
            )}
          </motion.div>
        </div>
      )}

      {/* Report Sighting Modal */}
      {showSightingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSightingModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 z-10"
          >
            <button
              onClick={() => setShowSightingModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-midnight-900">You've Seen {petName}?</h2>
              <p className="text-midnight-500 mt-2">This could help reunite them with their family!</p>
            </div>

            <div className="space-y-4">
              <Link
                href={`/mission-control?mission=${caseNumber}&action=sighting`}
                className="flex items-center gap-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl hover:bg-rose-100 transition"
              >
                <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-midnight-900">Submit Full Report</p>
                  <p className="text-midnight-500 text-sm">Add photos, location & details</p>
                </div>
                <ChevronRight className="w-5 h-5 text-midnight-400" />
              </Link>

              {caseData?.contact?.phone && (
                <a
                  href={`tel:${caseData.contact.phone}`}
                  className="flex items-center gap-4 p-4 bg-midnight-50 rounded-xl hover:bg-midnight-100 transition"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-midnight-900">Call Owner Now</p>
                    <p className="text-midnight-500 text-sm">For live sightings</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-midnight-400" />
                </a>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
          >
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-midnight-900">Share This Alert</h2>
              <p className="text-midnight-500 mt-2">Every share increases the chance of finding {petName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-4 bg-[#1877F2] text-white rounded-xl hover:opacity-90 transition font-semibold"
              >
                <Facebook className="w-5 h-5" />
                Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-4 bg-[#1DA1F2] text-white rounded-xl hover:opacity-90 transition font-semibold"
              >
                <Twitter className="w-5 h-5" />
                Twitter
              </a>
              <a
                href={`https://nextdoor.com/share/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-4 bg-[#8ED500] text-white rounded-xl hover:opacity-90 transition font-semibold"
              >
                <ExternalLink className="w-5 h-5" />
                Nextdoor
              </a>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 p-4 bg-midnight-100 text-midnight-900 rounded-xl hover:bg-midnight-200 transition font-semibold"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
