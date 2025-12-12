'use client';

/**
 * Share Mission - Quick volunteer recruitment
 *
 * Generates shareable links for:
 * - SMS (with pre-filled message)
 * - WhatsApp
 * - Copy link
 * - QR code for flyers
 */

import { useState, useEffect } from 'react';
import { TOUCH_TARGETS, triggerHaptic } from '@/app/lib/missionControl/accessibility';

export default function ShareMission({
  missionId,
  petName,
  petSpecies,
  isLive = false,
  compact = false,
  onShare = null,
}) {
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    // Generate the share URL
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/join/${missionId}`);
    }
  }, [missionId]);

  const getMessage = () => {
    if (isLive) {
      return `URGENT: ${petName} the ${petSpecies?.toLowerCase() || 'pet'} is missing and we need help NOW! Join the live search: ${shareUrl}`;
    }
    return `Help find ${petName}! A ${petSpecies?.toLowerCase() || 'pet'} has gone missing. Click to help search: ${shareUrl}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      triggerHaptic('success');
      setTimeout(() => setCopied(false), 2000);
      onShare?.('copy');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSMS = () => {
    const message = encodeURIComponent(getMessage());
    // iOS uses &body=, Android uses ?body=
    const smsUrl = `sms:?&body=${message}`;
    window.open(smsUrl, '_blank');
    triggerHaptic('tap');
    onShare?.('sms');
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(getMessage());
    const waUrl = `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');
    triggerHaptic('tap');
    onShare?.('whatsapp');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Help find ${petName}!`,
          text: getMessage(),
          url: shareUrl,
        });
        triggerHaptic('success');
        onShare?.('native');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      setShowShareSheet(true);
    }
  };

  // Compact mode - just a share button
  if (compact) {
    return (
      <button
        onClick={handleNativeShare}
        style={styles.compactButton}
        aria-label="Share search"
      >
        <span style={styles.shareIcon}>📤</span>
        Share
      </button>
    );
  }

  return (
    <div style={styles.container}>
      {/* Main share button */}
      <button onClick={handleNativeShare} style={styles.shareButton}>
        <span style={styles.shareButtonIcon}>📤</span>
        <div>
          <span style={styles.shareButtonText}>Share to Find {petName}</span>
          <span style={styles.shareButtonHint}>Invite volunteers to help search</span>
        </div>
      </button>

      {/* Quick actions */}
      <div style={styles.quickActions}>
        <button onClick={handleSMS} style={styles.quickButton}>
          <span style={styles.quickIcon}>💬</span>
          <span style={styles.quickLabel}>Text</span>
        </button>
        <button onClick={handleWhatsApp} style={styles.quickButton}>
          <span style={styles.quickIcon}>📱</span>
          <span style={styles.quickLabel}>WhatsApp</span>
        </button>
        <button onClick={handleCopyLink} style={styles.quickButton}>
          <span style={styles.quickIcon}>{copied ? '✓' : '🔗'}</span>
          <span style={styles.quickLabel}>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
        <button onClick={() => setShowQR(true)} style={styles.quickButton}>
          <span style={styles.quickIcon}>📷</span>
          <span style={styles.quickLabel}>QR Code</span>
        </button>
      </div>

      {/* Share Sheet Modal */}
      {showShareSheet && (
        <div style={styles.overlay} onClick={() => setShowShareSheet(false)}>
          <div style={styles.shareSheet} onClick={e => e.stopPropagation()}>
            <div style={styles.sheetHeader}>
              <h3 style={styles.sheetTitle}>Share Search for {petName}</h3>
              <button onClick={() => setShowShareSheet(false)} style={styles.closeButton}>
                ×
              </button>
            </div>

            <p style={styles.shareMessage}>{getMessage()}</p>

            <div style={styles.sheetOptions}>
              <button onClick={handleSMS} style={styles.sheetOption}>
                <span style={styles.optionIcon}>💬</span>
                <span style={styles.optionLabel}>Text Message</span>
              </button>
              <button onClick={handleWhatsApp} style={styles.sheetOption}>
                <span style={styles.optionIcon}>📱</span>
                <span style={styles.optionLabel}>WhatsApp</span>
              </button>
              <button onClick={handleCopyLink} style={styles.sheetOption}>
                <span style={styles.optionIcon}>{copied ? '✓' : '🔗'}</span>
                <span style={styles.optionLabel}>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button onClick={() => { setShowShareSheet(false); setShowQR(true); }} style={styles.sheetOption}>
                <span style={styles.optionIcon}>📷</span>
                <span style={styles.optionLabel}>QR Code</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div style={styles.overlay} onClick={() => setShowQR(false)}>
          <div style={styles.qrModal} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowQR(false)} style={styles.closeButton}>
              ×
            </button>
            <h3 style={styles.qrTitle}>Scan to Join Search</h3>
            <div style={styles.qrContainer}>
              {/* QR Code - using a simple API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`}
                alt="QR Code"
                style={styles.qrImage}
              />
            </div>
            <p style={styles.qrHint}>
              Print this for flyers or show to volunteers
            </p>
            <div style={styles.qrUrl}>{shareUrl}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  shareButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '16px 20px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: TOUCH_TARGETS.large,
  },

  shareButtonIcon: {
    fontSize: '28px',
  },

  shareButtonText: {
    display: 'block',
    fontSize: '18px',
    fontWeight: 700,
  },

  shareButtonHint: {
    display: 'block',
    fontSize: '13px',
    opacity: 0.8,
    marginTop: '2px',
  },

  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },

  quickButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 8px',
    backgroundColor: '#1E1E1E',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  quickIcon: {
    fontSize: '20px',
  },

  quickLabel: {
    fontSize: '11px',
    color: '#888',
  },

  compactButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.small,
  },

  shareIcon: {
    fontSize: '16px',
  },

  // Modal styles
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 9000,
    padding: '16px',
  },

  shareSheet: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#1E1E1E',
    borderRadius: '16px 16px 0 0',
    padding: '24px',
    marginBottom: '-16px',
  },

  sheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },

  sheetTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },

  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '28px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },

  shareMessage: {
    fontSize: '14px',
    color: '#888',
    backgroundColor: '#2A2A2A',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },

  sheetOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  sheetOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    backgroundColor: '#2A2A2A',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    minHeight: TOUCH_TARGETS.medium,
  },

  optionIcon: {
    fontSize: '24px',
  },

  optionLabel: {
    fontSize: '16px',
    fontWeight: 500,
  },

  // QR Modal
  qrModal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
    maxWidth: '320px',
    width: '100%',
    marginBottom: '20%',
    position: 'relative',
  },

  qrTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#000',
    margin: '0 0 16px 0',
  },

  qrContainer: {
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '8px',
    display: 'inline-block',
  },

  qrImage: {
    width: '200px',
    height: '200px',
    display: 'block',
  },

  qrHint: {
    fontSize: '14px',
    color: '#666',
    margin: '16px 0 8px 0',
  },

  qrUrl: {
    fontSize: '12px',
    color: '#2196F3',
    wordBreak: 'break-all',
    backgroundColor: '#f5f5f5',
    padding: '8px',
    borderRadius: '4px',
  },
};
