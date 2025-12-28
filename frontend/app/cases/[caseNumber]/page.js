'use client';

/**
 * Public Case Page
 *
 * A public-facing page for strangers who click on shared links.
 * Shows pet info, allows sighting reports, search joining, and ad boosting.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Clock, Share2, MessageCircle, Eye, Search,
  DollarSign, ArrowLeft, Phone, Mail, ChevronRight,
  Loader2, AlertCircle
} from 'lucide-react';

// Format time ago
const formatTimeAgo = (date) => {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString();
};

// Format pet type label
const formatPetType = (species) => {
  if (!species) return 'PET';
  return species.toUpperCase();
};

export default function PublicCasePage() {
  const params = useParams();
  const router = useRouter();
  const caseNumber = params.caseNumber;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);

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

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `Help find ${caseData?.petName || 'this pet'}! Last seen near ${caseData?.lastSeenAddress || 'unknown location'}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Lost ${caseData?.petSpecies}: ${caseData?.petName}`, text: shareText, url: shareUrl });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleReportSighting = () => {
    router.push(`/sighting/report?case=${caseNumber}`);
  };

  const handleJoinSearch = () => {
    router.push(`/mission-control?mission=${caseNumber}`);
  };

  const handleBoostAds = () => {
    router.push(`/cases/${caseNumber}/boost`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading case...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error}</h1>
          <p className="text-gray-500 mb-6">This case may have been resolved or removed.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  const petName = caseData?.petName || 'Unknown';
  const petType = formatPetType(caseData?.petSpecies);
  const petDetails = [caseData?.petBreed, caseData?.petColor, caseData?.petSize]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">
                LOST {petType}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowContactModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <MessageCircle className="w-4 h-4" />
              Message Owner
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto">
        {/* Pet Photo */}
        <div className="aspect-square bg-gray-200 relative">
          {caseData?.petPhotoUrl ? (
            <img
              src={caseData.petPhotoUrl}
              alt={petName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Search className="w-20 h-20 text-gray-300" />
            </div>
          )}
          {caseData?.isUrgent && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full">
              URGENT
            </div>
          )}
        </div>

        {/* Pet Info */}
        <div className="bg-white px-4 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{petName}</h1>
          {petDetails && (
            <p className="text-gray-500">{petDetails}</p>
          )}
          {caseData?.petDescription && (
            <p className="text-gray-600 mt-2 text-sm">{caseData.petDescription}</p>
          )}
        </div>

        {/* Last Seen */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Last Seen</h2>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-gray-900 font-medium">{caseData?.lastSeenAddress || 'Unknown location'}</p>
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTimeAgo(caseData?.lastSeenAt)}
              </p>
            </div>
          </div>

          {/* Map Preview */}
          {caseData?.lastSeenLatitude && caseData?.lastSeenLongitude && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100">
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+ef4444(${caseData.lastSeenLongitude},${caseData.lastSeenLatitude})/${caseData.lastSeenLongitude},${caseData.lastSeenLatitude},14,0/400x150@2x?access_token=pk.eyJ1IjoicGV0cmVjb3ZlcnkiLCJhIjoiY2x4eWpybjNxMDAwMzJrcXpwcml5MnVvYSJ9.placeholder`}
                alt="Map"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          {/* Primary: Report Sighting */}
          <button
            onClick={handleReportSighting}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-200 transition flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            I've Seen {petName}
          </button>

          {/* Secondary: Join Search */}
          <button
            onClick={handleJoinSearch}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-semibold text-lg transition flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            Join the Search
          </button>

          {/* Tertiary: Boost with Ads */}
          <button
            onClick={handleBoostAds}
            className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium border-2 border-gray-200 transition flex items-center justify-center gap-2"
          >
            <DollarSign className="w-5 h-5" />
            Boost with Ads
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 pb-8 pt-2">
          <p className="text-center text-sm text-gray-400">
            Case #{caseData?.missionNumber}
          </p>
        </div>
      </main>

      {/* Contact Owner Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowContactModal(false)}
          />
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl p-6 z-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Owner</h2>

            {caseData?.contact ? (
              <div className="space-y-4">
                {caseData.contact.name && (
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-900">{caseData.contact.name}</span> is looking for {petName}.
                  </p>
                )}

                {caseData.contact.phone && (
                  <a
                    href={`tel:${caseData.contact.phone}`}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Call</p>
                      <p className="text-sm text-gray-500">{caseData.contact.phone}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </a>
                )}

                {caseData.contact.email && (
                  <a
                    href={`mailto:${caseData.contact.email}?subject=Regarding ${petName} - Case ${caseNumber}`}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-500">{caseData.contact.email}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </a>
                )}

                <p className="text-xs text-gray-400 mt-4">
                  {caseData.contact.disclaimer}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Contact information not available.</p>
            )}

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
