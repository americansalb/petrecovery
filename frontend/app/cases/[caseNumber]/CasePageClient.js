'use client';

/**
 * Public Case Landing Page - The Perfect Lost Pet Page
 *
 * A living command center that serves two audiences:
 * 1. Pet Owner - checking status, managing their case
 * 2. Community Stranger - clicking a shared link, looking to help
 *
 * Design Philosophy: "Make the pet unforgettable in 3 seconds"
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Loader2, AlertCircle, ArrowRight, X, Eye, Phone, Mail,
  ChevronRight, Camera, MapPin, Facebook, Twitter, Copy, Check,
  ExternalLink, MessageSquare
} from 'lucide-react';

// Import components
import {
  HeroSection,
  SocialProofBar,
  MapPreview,
  ActivityTimeline,
  ActionCards,
  StickyMobileCTA
} from './components';

export default function CasePageClient() {
  const params = useParams();
  const router = useRouter();
  const caseNumber = params.caseNumber;

  // State
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSightingModal, setShowSightingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch case data
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

  // Sharing
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = caseData
    ? `Help find ${caseData.petName}! Lost ${caseData.petSpecies?.toLowerCase() || 'pet'} last seen near ${caseData.city || 'unknown location'}.`
    : '';

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
        // User cancelled or not supported
        setShowShareModal(true);
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
            <Loader2 className="w-12 h-12 text-rose-500 animate-spin mx-auto mb-4" />
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

  // Build latest activity for social proof bar
  const latestActivity = (() => {
    if (caseData?.sightings?.length > 0) {
      const latest = caseData.sightings[0];
      return {
        type: 'sighting',
        message: `${latest.reporterName} reported a sighting near ${latest.address?.split(',')[0] || 'the area'}`,
        time: latest.sightedAt
      };
    }
    if (caseData?.updates?.length > 0) {
      const latest = caseData.updates[0];
      return {
        type: 'update',
        message: latest.content?.substring(0, 80) + (latest.content?.length > 80 ? '...' : ''),
        time: latest.createdAt
      };
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-50 to-white">
      {/* Hero Section */}
      <HeroSection
        caseData={caseData}
        onContactOwner={() => setShowContactModal(true)}
      />

      {/* Primary CTA - Report Sighting (Mobile: in hero area, Desktop: prominent) */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-20">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowSightingModal(true)}
          className="w-full lg:w-auto bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl p-5 shadow-xl shadow-rose-200 transition group"
        >
          <div className="flex items-center justify-center lg:justify-start gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
              <Eye className="w-7 h-7" />
            </div>
            <div className="text-left">
              <p className="font-bold text-xl">I've Seen {petName}</p>
              <p className="text-rose-100">Report a sighting to help bring them home</p>
            </div>
            <ChevronRight className="w-6 h-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition hidden lg:block" />
          </div>
        </motion.button>
      </div>

      {/* Social Proof Bar */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <SocialProofBar
          viewCount={caseData?.viewCount || 0}
          shareCount={caseData?.shareCount || 0}
          activeSearchers={caseData?.activeSearchers || 0}
          sightingsCount={caseData?.sightingsCount || 0}
          latestActivity={latestActivity}
        />
      </div>

      {/* Main Content */}
      <section className="max-w-6xl mx-auto px-4 pb-32 lg:pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Map & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map Preview */}
            <MapPreview
              caseNumber={caseNumber}
              lastSeenLatitude={caseData?.lastSeenLatitude}
              lastSeenLongitude={caseData?.lastSeenLongitude}
              lastSeenAddress={caseData?.lastSeenAddress}
              sightings={caseData?.sightings || []}
              searchRadius={caseData?.searchRadius || 5}
            />

            {/* Activity Timeline */}
            <ActivityTimeline
              sightings={caseData?.sightings || []}
              updates={caseData?.updates || []}
              caseCreatedAt={caseData?.createdAt}
            />
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            <ActionCards
              caseNumber={caseNumber}
              caseData={caseData}
              onShare={handleNativeShare}
              onReportSighting={() => setShowSightingModal(true)}
            />

            {/* Case Info Footer */}
            <div className="bg-midnight-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-midnight-500">
                Case #{caseData?.missionNumber}
              </p>
              <p className="text-xs text-midnight-400 mt-1">
                Reported {new Date(caseData?.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA
        petName={petName}
        onReportSighting={() => setShowSightingModal(true)}
        onShare={handleNativeShare}
        ownerPhone={caseData?.contact?.phone}
      />

      {/* Contact Owner Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowContactModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
          >
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
              aria-label="Close"
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
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSightingModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 z-10"
          >
            <button
              onClick={() => setShowSightingModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
              aria-label="Close"
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
              {/* Quick sighting with location */}
              <Link
                href={`/mission-control?mission=${caseNumber}&action=sighting`}
                className="flex items-center gap-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl hover:bg-rose-100 transition"
              >
                <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-midnight-900">Submit Sighting Report</p>
                  <p className="text-midnight-500 text-sm">Add location, photos & details</p>
                </div>
                <ChevronRight className="w-5 h-5 text-midnight-400" />
              </Link>

              {/* Call owner directly */}
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
                    <p className="text-midnight-500 text-sm">For live sightings - fastest response</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-midnight-400" />
                </a>
              )}
            </div>

            {/* Help text */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800 font-medium mb-2">Tips for reporting:</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Note the exact location and time</li>
                <li>• Take a photo if possible (even from distance)</li>
                <li>• Don't chase - scared pets may run</li>
              </ul>
            </div>
          </motion.div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
          >
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-white" />
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

            {/* WhatsApp - very popular for local sharing */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 p-4 bg-[#25D366] text-white rounded-xl hover:opacity-90 transition font-semibold"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </motion.div>
        </div>
      )}
    </div>
  );
}
