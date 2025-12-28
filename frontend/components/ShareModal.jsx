'use client';

/**
 * ShareModal Component
 *
 * Provides pre-written, copy-paste-ready posts for sharing lost pet alerts
 * on various platforms (Facebook, Nextdoor, Text, Clipboard).
 */

import { useState } from 'react';
import { X, Facebook, MessageCircle, Copy, Check, ExternalLink, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';

// Format date for display
const formatDate = (date) => {
  if (!date) return 'recently';
  const d = new Date(date);
  const now = new Date();
  const diffHours = Math.floor((now - d) / (1000 * 60 * 60));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
};

// Capitalize first letter
const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

export default function ShareModal({ isOpen, onClose, pet }) {
  const [copiedPlatform, setCopiedPlatform] = useState(null);

  if (!isOpen) return null;

  // Generate case URL
  const caseUrl = pet?.caseNumber
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cases/${pet.caseNumber}`
    : typeof window !== 'undefined' ? window.location.href : '';

  // Pre-written posts for each platform
  const posts = {
    facebook: `🔴 LOST ${(pet?.type || 'PET').toUpperCase()} — Please help!

My ${pet?.type || 'pet'} ${pet?.name || ''} has been missing since ${formatDate(pet?.lastSeenAt)}.
${pet?.breed ? `${pet.breed}, ` : ''}${pet?.color || ''}.

Last seen near ${pet?.lastSeenAddress || pet?.city || 'my area'}.

If you've seen ${pet?.name || 'them'}, please contact me${pet?.ownerPhone ? `: ${pet.ownerPhone}` : ''}.

Or report a sighting here: ${caseUrl}

Please SHARE this post — someone you know might have seen ${pet?.name || 'them'}. 🙏

#Lost${capitalize(pet?.type)} ${pet?.city ? `#${pet.city.replace(/\s/g, '')}` : ''} #MissingPet`,

    nextdoor: `🔴 LOST ${(pet?.type || 'PET').toUpperCase()} in ${pet?.neighborhood || pet?.city || 'our area'}

Has anyone seen my ${pet?.type || 'pet'} ${pet?.name || ''}? ${pet?.breed || ''} ${pet?.color || ''}.
Missing since ${formatDate(pet?.lastSeenAt)} near ${pet?.lastSeenAddress || pet?.city || 'my area'}.

If you see ${pet?.name || 'them'}, please contact me${pet?.ownerPhone ? ` at ${pet.ownerPhone}` : ''}.

Full details: ${caseUrl}

Thank you neighbors! 🙏`,

    text: `Have you seen this ${pet?.type || 'pet'}? My ${pet?.breed || pet?.type || 'pet'} ${pet?.name || ''} went missing in ${pet?.city || 'my area'}. If you see ${pet?.name || 'them'}, please call me${pet?.ownerPhone ? ` at ${pet.ownerPhone}` : ''}. More info: ${caseUrl}`,

    clipboard: `🔴 LOST ${(pet?.type || 'PET').toUpperCase()} — ${(pet?.name || 'MY PET').toUpperCase()} — ${(pet?.city || '').toUpperCase()}

Missing since: ${formatDate(pet?.lastSeenAt)}
Last seen: ${pet?.lastSeenAddress || pet?.city || 'Unknown'}

Description: ${pet?.breed || pet?.type || 'Pet'}, ${pet?.color || 'Unknown color'}
${pet?.description || ''}

If found, PLEASE CONTACT${pet?.ownerPhone ? `: ${pet.ownerPhone}` : ' the owner'}

More photos and updates: ${caseUrl}

Please share! Someone you know might have seen ${pet?.name || 'them'}.`
  };

  const copyToClipboard = async (text, platform) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareToFacebook = () => {
    // Copy the post text first
    copyToClipboard(posts.facebook, 'facebook');
    // Open Facebook - user will paste the pre-written content
    const shareUrl = encodeURIComponent(caseUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank', 'width=600,height=400');
  };

  const shareToNextdoor = () => {
    // Copy the post text first
    copyToClipboard(posts.nextdoor, 'nextdoor');
    // Open Nextdoor - user will paste the pre-written content
    window.open('https://nextdoor.com/news_feed/', '_blank');
  };

  const shareViaText = () => {
    const smsUrl = `sms:?body=${encodeURIComponent(posts.text)}`;
    window.location.href = smsUrl;
  };

  const shareViaWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(posts.text + '\n\n' + caseUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lost ${pet?.type || 'Pet'}: ${pet?.name || 'Help Find Them'}`,
          text: posts.text,
          url: caseUrl,
        });
      } catch (err) {
        // User cancelled or error
        copyToClipboard(posts.clipboard, 'native');
      }
    } else {
      copyToClipboard(posts.clipboard, 'native');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Share {pet?.name || 'Pet'}'s Alert
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Quick Share Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={shareToFacebook}
              className="flex items-center justify-center gap-2 py-4 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold transition"
            >
              <Facebook className="w-5 h-5" />
              Facebook
            </button>

            <button
              onClick={shareToNextdoor}
              className="flex items-center justify-center gap-2 py-4 px-4 bg-[#00B246] hover:bg-[#00A03E] text-white rounded-xl font-semibold transition"
            >
              <ExternalLink className="w-5 h-5" />
              Nextdoor
            </button>

            <button
              onClick={shareViaText}
              className="flex items-center justify-center gap-2 py-4 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition"
            >
              <MessageCircle className="w-5 h-5" />
              Text
            </button>

            <button
              onClick={shareViaWhatsApp}
              className="flex items-center justify-center gap-2 py-4 px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl font-semibold transition"
            >
              <Smartphone className="w-5 h-5" />
              WhatsApp
            </button>
          </div>

          {/* Native Share (if supported) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              onClick={shareNative}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-semibold mb-6 transition"
            >
              <ExternalLink className="w-5 h-5" />
              More Sharing Options
            </button>
          )}

          {/* Copy for Craigslist/Reddit */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                For Craigslist, Reddit, or other sites
              </span>
              <button
                onClick={() => copyToClipboard(posts.clipboard, 'craigslist')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  copiedPlatform === 'craigslist'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {copiedPlatform === 'craigslist' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-white">
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                {posts.clipboard}
              </pre>
            </div>
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> Post in local Facebook groups, Nextdoor, and community pages.
              The more people who see {pet?.name || 'your pet'}'s alert, the better chance of finding them!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
