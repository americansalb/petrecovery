'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WipeSquadsPage() {
  const router = useRouter();
  const [wiping, setWiping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmStep, setConfirmStep] = useState(0); // 0: none, 1: first confirm, 2: type YES
  const [confirmText, setConfirmText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleWipe = () => {
    setConfirmStep(1);
  };

  const handleFirstConfirm = () => {
    setConfirmStep(2);
  };

  const handleFinalConfirm = async () => {
    if (confirmText !== 'YES') {
      setError('You must type YES to confirm deletion');
      setConfirmStep(0);
      setConfirmText('');
      return;
    }

    setConfirmStep(0);
    setConfirmText('');
    setWiping(true);
    setError('');
    setResult(null);
    setSuccessMessage('');

    try {
      const res = await fetch('/api/admin/wipe-forces', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to wipe force data');
      }

      setResult(data);
      setSuccessMessage('All force data has been wiped successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* First Confirmation Dialog */}
      {confirmStep === 1 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#dc2626' }}>
              ⚠️ WARNING: Destructive Action
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              This will delete ALL rescue force data including forces, members, assignments, and divisions.
              <br /><br />
              <strong style={{ color: '#dc2626' }}>This action cannot be undone.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmStep(0)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFirstConfirm}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Second Confirmation Dialog with Text Input */}
      {confirmStep === 2 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#dc2626' }}>
              Final Confirmation Required
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Type <strong>YES</strong> below to confirm you want to delete all force data.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type YES to confirm"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #dc2626',
                borderRadius: '8px',
                fontSize: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setConfirmStep(0); setConfirmText(''); }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                disabled={confirmText !== 'YES'}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: confirmText === 'YES' ? '#dc2626' : '#fca5a5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: confirmText === 'YES' ? 'pointer' : 'not-allowed',
                }}
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        maxWidth: '600px',
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Success Message */}
        {successMessage && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            border: '1px solid #10b981',
            borderRadius: '8px',
            color: '#065f46',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: '600',
          }}>
            ✅ {successMessage}
          </div>
        )}

        <h1 style={{
          fontSize: '2rem',
          fontWeight: '900',
          color: '#dc2626',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          ⚠️ Danger Zone: Wipe All Force Data
        </h1>

        <div style={{
          background: '#fee2e2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <p style={{
            color: '#991b1b',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            This will permanently delete:
          </p>
          <ul style={{
            color: '#991b1b',
            marginLeft: '1.5rem',
            lineHeight: '2'
          }}>
            <li>All rescue forces</li>
            <li>All force members</li>
            <li>All case assignments</li>
            <li>All case participants</li>
            <li>All divisions</li>
          </ul>
          <p style={{
            color: '#991b1b',
            fontWeight: '700',
            marginTop: '1rem'
          }}>
            ⚠️ This action CANNOT be undone!
          </p>
        </div>

        {result && (
          <div style={{
            background: '#d1fae5',
            border: '2px solid #10b981',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <p style={{
              color: '#065f46',
              fontWeight: '700',
              marginBottom: '1rem'
            }}>
              ✅ Successfully deleted:
            </p>
            <ul style={{
              color: '#065f46',
              marginLeft: '1.5rem',
              lineHeight: '2'
            }}>
              <li>{result.deleted?.forces || 0} forces</li>
              <li>{result.deleted?.members || 0} members</li>
              <li>{result.deleted?.assignments || 0} assignments</li>
              <li>{result.deleted?.participants || 0} participants</li>
              <li>{result.deleted?.divisions || 0} divisions</li>
            </ul>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            color: '#991b1b',
            fontWeight: '600'
          }}>
            ❌ Error: {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleWipe}
            disabled={wiping}
            style={{
              padding: '1rem 2rem',
              background: wiping ? '#cbd5e1' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: wiping ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {wiping ? 'Wiping Data...' : 'Delete All Force Data'}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '1rem 2rem',
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>

        <p style={{
          marginTop: '2rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.9rem'
        }}>
          After wiping, you can create new forces with proper coordinates for radius search.
        </p>
      </div>
    </div>
  );
}
