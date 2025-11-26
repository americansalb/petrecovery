'use client';

/**
 * Public Lost Pet Case Detail Page
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P04)
 *
 * Route: /cases/[caseNumber]
 * Public-facing detail page for individual lost pet cases
 * NO AUTHENTICATION REQUIRED
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { caseNumber } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (caseNumber) {
      fetchCaseDetail();
    }
  }, [caseNumber]);

  const fetchCaseDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/cases/${caseNumber}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setError('Case not found or not publicly available');
        } else {
          throw new Error(data.message || 'Failed to load case');
        }
        return;
      }

      setCaseData(data);
    } catch (err) {
      console.error('Error fetching case detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE_SEARCH': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'CLOSED_OTHER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'OPEN': return 'Open';
      case 'ACTIVE_SEARCH': return 'Active Search';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED_OTHER': return 'Closed';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lost Pet: ${caseData.petName || 'Unknown Pet'}`,
          text: `Help find this lost ${caseData.petSpecies} in ${caseData.city}, ${caseData.state}`,
          url: shareUrl
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 max-w-4xl py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Case Not Found</h1>
            <p className="text-red-600 mb-6">{error || 'This case does not exist or is not publicly available.'}</p>
            <button
              onClick={() => router.push('/cases')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Back to Cases List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 max-w-4xl py-6">
          <button
            onClick={() => router.push('/cases')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Cases List
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {caseData.petName || 'Unknown Pet'}
              </h1>
              <p className="text-gray-500">Case #{caseData.caseNumber}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(caseData.status)}`}>
              {getStatusLabel(caseData.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Image Section (Merged from Origin) */}
        {caseData.petPhotoUrl && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="aspect-video relative bg-gray-100">
              <img
                src={caseData.petPhotoUrl}
                alt={caseData.petName}
                className="w-full h-full object-cover"
              />
              {caseData.hasReward && (
                <div className="absolute top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                    ${caseData.rewardAmount?.toLocaleString()} REWARD
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Urgent Banner */}
        {caseData.isUrgent && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold">⚠️ URGENT CASE - Immediate assistance needed</p>
          </div>
        )}

        {/* Pet Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Pet Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Species</p>
              <p className="font-semibold">{caseData.petSpecies}</p>
            </div>
            {caseData.petBreed && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Breed</p>
                <p className="font-semibold">{caseData.petBreed}</p>
              </div>
            )}
            {caseData.petColor && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Color</p>
                <p className="font-semibold">{caseData.petColor}</p>
              </div>
            )}
            {caseData.petSize && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Size</p>
                <p className="font-semibold">{caseData.petSize}</p>
              </div>
            )}
          </div>
          {caseData.petDescription && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-gray-700">{caseData.petDescription}</p>
            </div>
          )}
        </div>

        {/* Location Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Last Known Location</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 mb-1">City/State</p>
              <p className="font-semibold">{caseData.city}, {caseData.state} {caseData.zipCode && `(${caseData.zipCode})`}</p>
            </div>
            {caseData.lastSeenAddress && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Address/Area</p>
                <p className="font-semibold">{caseData.lastSeenAddress}</p>
              </div>
            )}
            {caseData.lastSeenLandmark && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Landmark</p>
                <p className="text-gray-700">{caseData.lastSeenLandmark}</p>
              </div>
            )}
            {caseData.lastSeenAt && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Last Seen Date</p>
                <p className="text-gray-700">{formatDate(caseData.lastSeenAt)} at {formatTime(caseData.lastSeenAt)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Contact Information</h2>
          {caseData.contact?.available !== false ? (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Safety Reminder:</strong> Please exercise caution when communicating with strangers.
                  Meet in public places and consider bringing a friend.
                </p>
              </div>
              <div className="space-y-3">
                {caseData.contact?.name && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Name</p>
                    <p className="font-semibold">{caseData.contact.name}</p>
                  </div>
                )}
                {caseData.contact?.phone && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Phone</p>
                    <p className="font-semibold">
                      <a href={`tel:${caseData.contact.phone}`} className="text-blue-600 hover:text-blue-800">
                        {caseData.contact.phone}
                      </a>
                    </p>
                  </div>
                )}
                {caseData.contact?.email && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="font-semibold">
                      <a href={`mailto:${caseData.contact.email}`} className="text-blue-600 hover:text-blue-800">
                        {caseData.contact.email}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600">
                {caseData.contact?.message || 'Contact information is not publicly available for this case.'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                If you have information about this case, please contact local animal control or police.
              </p>
            </div>
          )}
        </div>

        {/* Sightings (Merged from Origin) */}
        {caseData.sightings && caseData.sightings.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Recent Sightings ({caseData.sightings.length})</h2>
            <div className="space-y-3">
              {caseData.sightings.map((sighting) => (
                <div key={sighting.id} className="bg-blue-50 rounded-lg p-4">
                  <p className="text-blue-900 font-medium">{sighting.address}</p>
                  <p className="text-blue-700 text-sm">
                    {formatDate(sighting.sightedAt)} at {formatTime(sighting.sightedAt)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${sighting.certaintyLevel >= 4 ? 'bg-green-100 text-green-800' :
                        sighting.certaintyLevel >= 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      Certainty: {sighting.certaintyLevel}/5
                    </span>
                    {sighting.isVerified && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Case Status */}
        {caseData.statusReason && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Status Update</h2>
            <p className="text-gray-700">{caseData.statusReason}</p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Help Spread the Word</h2>
          <p className="text-gray-600 mb-4">
            Share this case on social media to help reunite {caseData.petName || 'this pet'} with their family.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              {copySuccess ? '✓ Link Copied!' : 'Share This Case'}
            </button>
            <button
              onClick={() => router.push('/cases')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
            >
              Back to All Cases
            </button>
          </div>
          {/* View Count (Merged from Origin) */}
          {caseData.viewCount > 0 && (
            <p className="text-gray-400 text-sm text-center mt-6">
              {caseData.viewCount.toLocaleString()} views &bull; Posted {formatDate(caseData.createdAt)}
            </p>
          )}
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-600">
            <strong>Disclaimer:</strong> This information is provided as a community service. PetRecovery.org is not responsible
            for the accuracy of the information provided or any interactions that result from this posting. Always exercise
            caution and common sense when meeting strangers or investigating lost pet cases.
          </p>
        </div>
      </div>
    </div>
  );
}
