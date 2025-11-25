'use client';

// /cases/[caseNumber]/page.js
// Public case detail page

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PublicCaseDetailPage() {
  const params = useParams();
  const { caseNumber } = params;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (caseNumber) {
      fetchCase();
    }
  }, [caseNumber]);

  async function fetchCase() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/cases/${caseNumber}`);
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
      console.error('Failed to load case:', err);
      setError('Failed to load case');
    }
    setLoading(false);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function shareCase() {
    if (navigator.share) {
      navigator.share({
        title: `LOST: ${caseData.petName}`,
        text: `Help find ${caseData.petName}! Last seen near ${caseData.lastSeenAddress}`,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-red-600"></div>
          <p className="mt-2 text-gray-600">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{error}</h1>
          <p className="text-gray-600 mt-2">This case may not exist or is not publicly visible.</p>
          <Link href="/cases" className="text-red-600 hover:underline mt-4 inline-block">
            &larr; Back to Lost Pets
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = {
    ACTIVE: 'bg-red-100 text-red-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    SIGHTING_REPORTED: 'bg-blue-100 text-blue-800',
    REUNITED: 'bg-green-100 text-green-800',
    CLOSED_OTHER: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/cases" className="text-red-600 hover:underline">
              &larr; Back to Lost Pets
            </Link>
            <button
              onClick={shareCase}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Pet Photo */}
          <div className="aspect-video relative bg-gray-100">
            <img
              src={caseData.petPhotoUrl}
              alt={caseData.petName}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${statusColors[caseData.status]}`}>
                {caseData.status.replace(/_/g, ' ')}
              </span>
            </div>
            {caseData.hasReward && (
              <div className="absolute top-4 right-4">
                <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                  ${caseData.rewardAmount?.toLocaleString()} REWARD
                </span>
              </div>
            )}
          </div>

          {/* Case Info */}
          <div className="p-6">
            {/* Case Number & Pet Name */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 font-mono">Case #{caseData.caseNumber}</p>
              <h1 className="text-3xl font-bold text-gray-900">{caseData.petName}</h1>
              <p className="text-lg text-gray-600 mt-1">
                {caseData.petBreed || caseData.petSpecies} &bull; {caseData.petSize} &bull; {caseData.petColor}
              </p>
            </div>

            {/* Last Seen */}
            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <h2 className="font-bold text-red-800 mb-2">Last Seen</h2>
              <p className="text-red-900 font-medium">{caseData.lastSeenAddress}</p>
              <p className="text-red-700 text-sm mt-1">
                {formatDate(caseData.lastSeenAt)} at {formatTime(caseData.lastSeenAt)}
              </p>
            </div>

            {/* Description */}
            {caseData.petDescription && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-700">{caseData.petDescription}</p>
              </div>
            )}

            {/* How They Got Out */}
            <div className="mb-6">
              <h2 className="font-bold text-gray-900 mb-2">How They Got Out</h2>
              <p className="text-gray-700">{caseData.escapeScenario}</p>
              {caseData.escapeDetails && (
                <p className="text-gray-600 text-sm mt-1">{caseData.escapeDetails}</p>
              )}
            </div>

            {/* Contact */}
            {caseData.publicContactOk && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h2 className="font-bold text-gray-900 mb-2">Contact {caseData.ownerFirstName}</h2>
                {caseData.ownerPhone && (
                  <p className="text-gray-700">
                    Phone: <a href={`tel:${caseData.ownerPhone}`} className="text-red-600 hover:underline">{caseData.ownerPhone}</a>
                  </p>
                )}
                {caseData.ownerEmail && (
                  <p className="text-gray-700">
                    Email: <a href={`mailto:${caseData.ownerEmail}`} className="text-red-600 hover:underline">{caseData.ownerEmail}</a>
                  </p>
                )}
                {!caseData.ownerPhone && !caseData.ownerEmail && (
                  <p className="text-gray-500 text-sm">
                    Contact information not publicly shared. If you have information, report a sighting below.
                  </p>
                )}
              </div>
            )}

            {/* Sightings */}
            {caseData.sightings && caseData.sightings.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 mb-3">Recent Sightings ({caseData.sightings.length})</h2>
                <div className="space-y-3">
                  {caseData.sightings.map((sighting) => (
                    <div key={sighting.id} className="bg-blue-50 rounded-lg p-3">
                      <p className="text-blue-900 font-medium">{sighting.address}</p>
                      <p className="text-blue-700 text-sm">
                        {formatDate(sighting.sightedAt)} at {formatTime(sighting.sightedAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          sighting.certaintyLevel >= 4 ? 'bg-green-100 text-green-800' :
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

            {/* View Count */}
            <p className="text-gray-400 text-sm text-center mt-6">
              {caseData.viewCount?.toLocaleString()} views &bull; Posted {formatDate(caseData.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <button
            onClick={shareCase}
            className="bg-white border border-gray-300 hover:bg-gray-50 px-6 py-3 rounded-lg font-medium"
          >
            Share This Case
          </button>
          <Link
            href="/cases/report"
            className="bg-red-600 text-white hover:bg-red-700 px-6 py-3 rounded-lg font-medium"
          >
            Report a Lost Pet
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>PetRecovery.org - Helping lost pets find their way home</p>
        </div>
      </footer>
    </div>
  );
}
