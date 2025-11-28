'use client';

import { useState, useEffect } from 'react';

/**
 * SocialShare Component
 *
 * Provides share buttons for Facebook, Twitter, Nextdoor, and native share.
 * Tracks share events and generates shareable links.
 */
export default function SocialShare({
  caseId,
  petName,
  petType,
  description,
  imageUrl,
  lastSeenLocation,
  variant = 'buttons', // 'buttons' | 'icons' | 'dropdown'
  size = 'medium', // 'small' | 'medium' | 'large'
  showCounts = false,
  onShare = () => {}
}) {
  const [shareCounts, setShareCounts] = useState({
    facebook: 0,
    twitter: 0,
    nextdoor: 0,
    copy: 0,
    native: 0
  });
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tracking, setTracking] = useState(false);

  // Generate shareable URL
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cases/${caseId}`
    : `/cases/${caseId}`;

  // Generate share text
  const shareTitle = `Help Find ${petName}!`;
  const shareText = `Missing ${petType}: ${petName}. Last seen near ${lastSeenLocation}. ${description?.substring(0, 100)}...`;

  // Load share counts on mount
  useEffect(() => {
    if (showCounts && caseId) {
      loadShareCounts();
    }
  }, [caseId, showCounts]);

  const loadShareCounts = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/share-stats`);
      if (res.ok) {
        const data = await res.json();
        setShareCounts(data.counts || {});
      }
    } catch (error) {
      console.error('Error loading share counts:', error);
    }
  };

  // Track share event
  const trackShare = async (platform) => {
    if (tracking) return;
    setTracking(true);

    try {
      await fetch(`/api/cases/${caseId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });

      setShareCounts(prev => ({
        ...prev,
        [platform]: (prev[platform] || 0) + 1
      }));

      onShare(platform);
    } catch (error) {
      console.error('Error tracking share:', error);
    } finally {
      setTracking(false);
    }
  };

  // Share handlers
  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, 'facebook-share', 'width=580,height=296');
    trackShare('facebook');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=LostPet,HelpFind${petName?.replace(/\s+/g, '')}`;
    window.open(url, 'twitter-share', 'width=550,height=235');
    trackShare('twitter');
  };

  const shareToNextdoor = () => {
    // Nextdoor doesn't have a direct share URL, but we can use their share intent
    const url = `https://nextdoor.com/share/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
    window.open(url, 'nextdoor-share', 'width=600,height=400');
    trackShare('nextdoor');
  };

  const shareToEmail = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\nView the full listing: ${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    trackShare('email');
  };

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
    window.open(url, 'whatsapp-share');
    trackShare('whatsapp');
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, 'linkedin-share', 'width=600,height=400');
    trackShare('linkedin');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      trackShare('copy');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        trackShare('native');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      setShowDropdown(true);
    }
  };

  // Size classes
  const sizeClasses = {
    small: { button: '0.5rem 0.75rem', icon: '16px', text: '0.8rem' },
    medium: { button: '0.75rem 1rem', icon: '20px', text: '0.9rem' },
    large: { button: '1rem 1.5rem', icon: '24px', text: '1rem' }
  };

  const currentSize = sizeClasses[size] || sizeClasses.medium;

  // Social platform configs
  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: '#1877F2',
      hoverColor: '#166FE5',
      onClick: shareToFacebook
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: '#000000',
      hoverColor: '#333333',
      onClick: shareToTwitter
    },
    {
      id: 'nextdoor',
      name: 'Nextdoor',
      icon: (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 14.5h-3v-4.5c0-.828-.672-1.5-1.5-1.5s-1.5.672-1.5 1.5v4.5h-3V9h3v1.5c.69-1.067 1.862-1.5 3-1.5 2.071 0 3 1.429 3 3.5v4z"/>
        </svg>
      ),
      color: '#8ED500',
      hoverColor: '#7BC400',
      onClick: shareToNextdoor
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      color: '#25D366',
      hoverColor: '#20BD5A',
      onClick: shareToWhatsApp
    },
    {
      id: 'email',
      name: 'Email',
      icon: (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      ),
      color: '#EA4335',
      hoverColor: '#D33426',
      onClick: shareToEmail
    },
    {
      id: 'copy',
      name: copied ? 'Copied!' : 'Copy Link',
      icon: copied ? (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      ) : (
        <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      ),
      color: copied ? '#10B981' : '#6B7280',
      hoverColor: copied ? '#059669' : '#4B5563',
      onClick: copyToClipboard
    }
  ];

  // Render based on variant
  if (variant === 'icons') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {platforms.map(platform => (
          <button
            key={platform.id}
            onClick={platform.onClick}
            title={platform.name}
            style={{
              width: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
              height: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
              borderRadius: '50%',
              border: 'none',
              background: platform.color,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = platform.hoverColor}
            onMouseLeave={(e) => e.currentTarget.style.background = platform.color}
          >
            {platform.icon}
            {showCounts && shareCounts[platform.id] > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#EF4444',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: '700',
                padding: '2px 5px',
                borderRadius: '10px',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {shareCounts[platform.id]}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => navigator.share ? nativeShare() : setShowDropdown(!showDropdown)}
          style={{
            padding: currentSize.button,
            background: '#667EEA',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: currentSize.text,
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#5A67D8'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#667EEA'}
        >
          <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
          Share
        </button>

        {showDropdown && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999
              }}
              onClick={() => setShowDropdown(false)}
            />
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              padding: '0.5rem',
              minWidth: '200px',
              zIndex: 1000
            }}>
              {platforms.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => {
                    platform.onClick();
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.95rem',
                    color: '#1F2937',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: platform.color }}>{platform.icon}</span>
                  <span>{platform.name}</span>
                  {showCounts && shareCounts[platform.id] > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.8rem',
                      color: '#6B7280'
                    }}>
                      {shareCounts[platform.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Default: buttons variant
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {platforms.slice(0, 4).map(platform => (
          <button
            key={platform.id}
            onClick={platform.onClick}
            style={{
              padding: currentSize.button,
              background: platform.color,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: currentSize.text,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = platform.hoverColor}
            onMouseLeave={(e) => e.currentTarget.style.background = platform.color}
          >
            {platform.icon}
            <span>{platform.name}</span>
            {showCounts && shareCounts[platform.id] > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.8rem'
              }}>
                {shareCounts[platform.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {platforms.slice(4).map(platform => (
          <button
            key={platform.id}
            onClick={platform.onClick}
            style={{
              padding: currentSize.button,
              background: platform.color,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: currentSize.text,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = platform.hoverColor}
            onMouseLeave={(e) => e.currentTarget.style.background = platform.color}
          >
            {platform.icon}
            <span>{platform.name}</span>
          </button>
        ))}

        {/* Native share button for mobile */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            onClick={nativeShare}
            style={{
              padding: currentSize.button,
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: currentSize.text,
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#7C3AED'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#8B5CF6'}
          >
            <svg width={currentSize.icon} height={currentSize.icon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
            <span>More...</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SharePreview Component
 *
 * Shows a preview of how the share will look on social media
 */
export function SharePreview({ petName, petType, description, imageUrl, url }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      overflow: 'hidden',
      maxWidth: '500px',
      background: 'white'
    }}>
      {imageUrl && (
        <div style={{
          width: '100%',
          height: '260px',
          background: '#F3F4F6',
          overflow: 'hidden'
        }}>
          <img
            src={imageUrl}
            alt={petName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      )}
      <div style={{ padding: '1rem' }}>
        <div style={{
          fontSize: '0.8rem',
          color: '#6B7280',
          marginBottom: '0.25rem',
          textTransform: 'uppercase'
        }}>
          petrecovery.org
        </div>
        <div style={{
          fontSize: '1.1rem',
          fontWeight: '700',
          color: '#1F2937',
          marginBottom: '0.5rem'
        }}>
          Help Find {petName}! - Missing {petType}
        </div>
        <div style={{
          fontSize: '0.9rem',
          color: '#4B5563',
          lineHeight: '1.5'
        }}>
          {description?.substring(0, 150)}...
        </div>
      </div>
    </div>
  );
}
