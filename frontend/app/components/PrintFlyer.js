'use client';

import { useState } from 'react';
import { FLYER_PRESETS, printFlyer, downloadFlyerHTML } from '../lib/flyerGenerator';

/**
 * PrintFlyer Component
 *
 * Allows users to generate and print lost pet flyers.
 * Supports multiple formats and customization options.
 */
export default function PrintFlyer({ caseData, onClose }) {
  const [format, setFormat] = useState('LETTER');
  const [options, setOptions] = useState({
    includeQR: true,
    includePhoto: true,
    includeReward: true,
    includeContact: true,
    primaryColor: '#DC2626',
    customMessage: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handlePrint = async () => {
    setGenerating(true);
    try {
      printFlyer(caseData, { ...options, format });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      downloadFlyerHTML(caseData, { ...options, format });
    } finally {
      setGenerating(false);
    }
  };

  const colorOptions = [
    { value: '#DC2626', label: 'Red', color: '#DC2626' },
    { value: '#2563EB', label: 'Blue', color: '#2563EB' },
    { value: '#059669', label: 'Green', color: '#059669' },
    { value: '#7C3AED', label: 'Purple', color: '#7C3AED' },
    { value: '#EA580C', label: 'Orange', color: '#EA580C' },
    { value: '#0891B2', label: 'Teal', color: '#0891B2' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#1F2937',
              marginBottom: '0.25rem'
            }}>
              Print Flyer
            </h2>
            <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
              Create a printable flyer for {caseData.petName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '0.5rem'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Format Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '0.75rem',
              color: '#374151'
            }}>
              Flyer Size
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem'
            }}>
              {Object.entries(FLYER_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${format === key ? '#667EEA' : '#E5E7EB'}`,
                    borderRadius: '8px',
                    background: format === key ? '#EEF2FF' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    fontWeight: '600',
                    color: format === key ? '#4F46E5' : '#374151',
                    marginBottom: '0.25rem'
                  }}>
                    {preset.name}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#6B7280'
                  }}>
                    {Math.round(preset.width / 72)}" x {Math.round(preset.height / 72)}"
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '0.75rem',
              color: '#374151'
            }}>
              Primary Color
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  onClick={() => setOptions(prev => ({ ...prev, primaryColor: color.value }))}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: color.color,
                    border: options.primaryColor === color.value
                      ? '3px solid #1F2937'
                      : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '0.75rem',
              color: '#374151'
            }}>
              Include
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { key: 'includePhoto', label: 'Pet Photo' },
                { key: 'includeQR', label: 'QR Code (links to case page)' },
                { key: 'includeContact', label: 'Contact Information' },
                { key: 'includeReward', label: 'Reward Information' }
              ].map(opt => (
                <label
                  key={opt.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: options[opt.key] ? '#F0FDF4' : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={options[opt.key]}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      [opt.key]: e.target.checked
                    }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#10B981'
                    }}
                  />
                  <span style={{ color: '#374151' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: '#374151'
            }}>
              Custom Message (optional)
            </label>
            <textarea
              value={options.customMessage}
              onChange={(e) => setOptions(prev => ({
                ...prev,
                customMessage: e.target.value
              }))}
              placeholder="Add a personal message to your flyer..."
              maxLength={200}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '0.95rem',
                resize: 'vertical',
                minHeight: '80px'
              }}
            />
            <div style={{
              fontSize: '0.8rem',
              color: '#6B7280',
              marginTop: '0.25rem',
              textAlign: 'right'
            }}>
              {options.customMessage.length}/200
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: '1rem',
            background: '#F9FAFB',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Preview</span>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667EEA',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
            </div>

            {showPreview && (
              <div style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{
                  background: options.primaryColor,
                  color: 'white',
                  padding: '0.75rem',
                  fontWeight: '700',
                  marginBottom: '0.75rem',
                  borderRadius: '4px'
                }}>
                  LOST {caseData.petSpecies?.toUpperCase()}
                </div>

                {options.includePhoto && caseData.petPhotoUrl && (
                  <img
                    src={caseData.petPhotoUrl}
                    alt={caseData.petName}
                    style={{
                      width: '120px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}
                  />
                )}

                <div style={{
                  fontWeight: '700',
                  color: options.primaryColor,
                  marginBottom: '0.25rem'
                }}>
                  "{caseData.petName}"
                </div>

                <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                  {caseData.petBreed || caseData.petSpecies} - {caseData.petColor}
                </div>

                {options.customMessage && (
                  <div style={{
                    fontSize: '0.75rem',
                    fontStyle: 'italic',
                    color: '#6B7280',
                    marginTop: '0.5rem'
                  }}>
                    "{options.customMessage.substring(0, 50)}..."
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Print Tips */}
          <div style={{
            padding: '1rem',
            background: '#FEF3C7',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#92400E'
          }}>
            <strong>Printing Tips:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              <li>Use bright colored paper (yellow, green, pink) for better visibility</li>
              <li>Print multiple copies to post in different locations</li>
              <li>Laminate flyers for outdoor use</li>
              <li>Include tear-off strips for phone numbers</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          gap: '1rem'
        }}>
          <button
            onClick={handleDownload}
            disabled={generating}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'white',
              color: '#374151',
              border: '2px solid #E5E7EB',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download HTML
          </button>

          <button
            onClick={handlePrint}
            disabled={generating}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: generating ? '#9CA3AF' : '#667EEA',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            {generating ? 'Generating...' : 'Print Flyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PrintFlyerButton - Simple button to trigger flyer modal
 */
export function PrintFlyerButton({ caseData, variant = 'primary', size = 'medium' }) {
  const [showModal, setShowModal] = useState(false);

  const sizeStyles = {
    small: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
    medium: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
    large: { padding: '1rem 2rem', fontSize: '1.125rem' }
  };

  const variantStyles = {
    primary: {
      background: '#667EEA',
      color: 'white',
      border: 'none'
    },
    secondary: {
      background: 'white',
      color: '#667EEA',
      border: '2px solid #667EEA'
    },
    outline: {
      background: 'transparent',
      color: '#374151',
      border: '2px solid #E5E7EB'
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          ...sizeStyles[size],
          ...variantStyles[variant],
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print Flyer
      </button>

      {showModal && (
        <PrintFlyer caseData={caseData} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
