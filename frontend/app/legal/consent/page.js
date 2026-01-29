'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Legal Consent Page
 * Phase 0: Legal Baseline - User-facing legal acceptance flow
 *
 * Allows users to review and accept Terms of Service and Liability Waiver
 * before participating in rescue squad activities.
 */
function LegalConsentContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  // State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  const [acceptances, setAcceptances] = useState({
    TERMS_OF_SERVICE: false,
    LIABILITY_WAIVER: false
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?returnUrl=${encodeURIComponent('/legal/consent')}`);
    }
  }, [status, router]);

  // Fetch legal documents on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDocuments();
    }
  }, [status]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/legal/documents');
      if (!response.ok) throw new Error('Failed to fetch legal documents');

      const data = await response.json();
      setDocuments(data.documents);

      console.log('📄 [Legal Consent] Loaded documents:', data.documents.map(d => d.type));
    } catch (err) {
      console.error('❌ [Legal Consent] Failed to fetch documents:', err);
      setError('Failed to load legal documents. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (docType) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docType)) {
        next.delete(docType);
      } else {
        next.add(docType);
      }
      return next;
    });
  };

  const toggleAcceptance = (docType) => {
    setAcceptances(prev => ({
      ...prev,
      [docType]: !prev[docType]
    }));
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      console.log('📝 [Legal Consent] Submitting acceptances...');

      // Build acceptances payload
      const acceptancePayload = documents
        .filter(doc => acceptances[doc.type])
        .map(doc => ({
          documentType: doc.type,
          version: doc.version
        }));

      const response = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptances: acceptancePayload })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept documents');
      }

      console.log('✅ [Legal Consent] Acceptance successful');
      setSuccess(true);

      // Redirect after short delay
      setTimeout(() => {
        if (returnUrl) {
          console.log(`↪️  [Legal Consent] Redirecting to: ${returnUrl}`);
          router.push(returnUrl);
        } else {
          console.log('↪️  [Legal Consent] Redirecting to dashboard');
          router.push('/dashboard');
        }
      }, 1500);

    } catch (err) {
      console.error('❌ [Legal Consent] Acceptance failed:', err);
      setError(err.message);
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            Loading legal documents...
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (status === 'unauthenticated') {
    return null; // Will redirect via useEffect
  }

  // Find required documents
  const tosDoc = documents.find(d => d.type === 'TERMS_OF_SERVICE');
  const waiverDoc = documents.find(d => d.type === 'LIABILITY_WAIVER');
  const privacyDoc = documents.find(d => d.type === 'PRIVACY_POLICY');

  const allRequiredAccepted = acceptances.TERMS_OF_SERVICE && acceptances.LIABILITY_WAIVER;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '900',
            color: '#0f172a',
            marginBottom: '0.5rem'
          }}>
            Legal Agreements Required
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            lineHeight: '1.6'
          }}>
            {returnUrl ? (
              <>
                Before you can participate in rescue force activities, please review and accept our legal agreements below.
                These protect both you and the ReunitePets.org community.
              </>
            ) : (
              <>
                Review and accept our Terms of Service and Volunteer Liability Waiver to participate in rescue activities.
              </>
            )}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            background: '#d1fae5',
            border: '2px solid #10b981',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: '700', color: '#065f46', marginBottom: '0.25rem' }}>
                  Legal agreements accepted!
                </div>
                <div style={{ color: '#047857', fontSize: '0.9rem' }}>
                  {returnUrl ? 'Redirecting you back...' : 'Redirecting to dashboard...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>❌</span>
              <div>
                <div style={{ fontWeight: '700', color: '#991b1b', marginBottom: '0.25rem' }}>
                  Failed to accept agreements
                </div>
                <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* Terms of Service */}
          {tosDoc && (
            <DocumentCard
              doc={tosDoc}
              expanded={expandedDocs.has(tosDoc.type)}
              accepted={acceptances.TERMS_OF_SERVICE}
              onToggleExpand={() => toggleExpanded(tosDoc.type)}
              onToggleAccept={() => toggleAcceptance(tosDoc.type)}
              required={true}
              icon="📜"
            />
          )}

          {/* Liability Waiver */}
          {waiverDoc && (
            <DocumentCard
              doc={waiverDoc}
              expanded={expandedDocs.has(waiverDoc.type)}
              accepted={acceptances.LIABILITY_WAIVER}
              onToggleExpand={() => toggleExpanded(waiverDoc.type)}
              onToggleAccept={() => toggleAcceptance(waiverDoc.type)}
              required={true}
              icon="⚠️"
            />
          )}

          {/* Privacy Policy (Info Only) */}
          {privacyDoc && (
            <DocumentCard
              doc={privacyDoc}
              expanded={expandedDocs.has(privacyDoc.type)}
              accepted={false}
              onToggleExpand={() => toggleExpanded(privacyDoc.type)}
              onToggleAccept={null}
              required={false}
              icon="🔒"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            {!allRequiredAccepted && (
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                ✓ Please check both required agreements above to continue
              </div>
            )}
            {allRequiredAccepted && !success && (
              <div style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: '600' }}>
                ✓ All required agreements checked
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href={returnUrl || '/dashboard'}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#64748b',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '700'
              }}
            >
              I Need More Time
            </Link>

            <button
              onClick={handleAccept}
              disabled={!allRequiredAccepted || accepting || success}
              style={{
                padding: '0.75rem 2rem',
                background: allRequiredAccepted && !accepting && !success ? '#10b981' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: allRequiredAccepted && !accepting && !success ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {accepting ? 'Accepting...' : success ? 'Accepted ✓' : 'Agree and Continue'}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        {returnUrl && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#f1f5f9',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#64748b',
            textAlign: 'center'
          }}>
            After accepting, you'll be redirected back to continue your action
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function LegalConsentPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #f0f9ff, #e0f2fe)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
          <div style={{ color: '#64748b' }}>Loading legal documents...</div>
        </div>
      </div>
    }>
      <LegalConsentContent />
    </Suspense>
  );
}

/**
 * Document Card Component
 * Displays a legal document with summary, full content toggle, and acceptance checkbox
 */
function DocumentCard({ doc, expanded, accepted, onToggleExpand, onToggleAccept, required, icon }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      border: required ? '2px solid #e2e8f0' : '1px solid #f1f5f9'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#0f172a',
            margin: 0
          }}>
            {doc.title}
          </h2>
          {required && (
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}>
              REQUIRED
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Version {doc.version} • Last updated {new Date(doc.publishedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <p style={{ margin: 0, color: '#475569', lineHeight: '1.6' }}>
          {doc.summary}
        </p>
      </div>

      {/* Toggle Full Content */}
      <button
        onClick={onToggleExpand}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: expanded ? '#e0e7ff' : '#f1f5f9',
          border: 'none',
          borderRadius: '8px',
          color: expanded ? '#4338ca' : '#64748b',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '1rem',
          transition: 'all 0.2s'
        }}
      >
        {expanded ? '▼ Hide Full Text' : '▶ Read Full Text'}
      </button>

      {/* Full Content (Expandable) */}
      {expanded && (
        <div style={{
          padding: '1.5rem',
          background: '#fafafa',
          borderRadius: '8px',
          marginBottom: '1rem',
          maxHeight: '400px',
          overflowY: 'auto',
          fontSize: '0.9rem',
          lineHeight: '1.8',
          color: '#374151',
          whiteSpace: 'pre-wrap'
        }}>
          {doc.content}
        </div>
      )}

      {/* Acceptance Checkbox (if required) */}
      {required && onToggleAccept && (
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          background: accepted ? '#d1fae5' : '#f8fafc',
          border: `2px solid ${accepted ? '#10b981' : '#e2e8f0'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={onToggleAccept}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer'
            }}
          />
          <span style={{
            fontWeight: '600',
            color: accepted ? '#065f46' : '#475569'
          }}>
            I have read and agree to the {doc.title} (v{doc.version})
          </span>
        </label>
      )}
    </div>
  );
}
