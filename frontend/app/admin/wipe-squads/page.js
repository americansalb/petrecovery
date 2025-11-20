'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WipeSquadsPage() {
  const router = useRouter();
  const [wiping, setWiping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleWipe = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL rescue squad data (squads, members, assignments, divisions). This cannot be undone. Are you absolutely sure?')) {
      return;
    }

    if (!confirm('This is your FINAL confirmation. Type YES in the next prompt to proceed.')) {
      return;
    }

    const confirmation = prompt('Type YES to confirm deletion:');
    if (confirmation !== 'YES') {
      alert('Deletion cancelled.');
      return;
    }

    setWiping(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/admin/wipe-squads', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to wipe squad data');
      }

      setResult(data);
      alert('✅ All squad data has been wiped successfully!');
    } catch (err) {
      setError(err.message);
      alert('❌ Error: ' + err.message);
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
      <div style={{
        maxWidth: '600px',
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '900',
          color: '#dc2626',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          ⚠️ Danger Zone: Wipe All Squad Data
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
            <li>All rescue squads</li>
            <li>All squad members</li>
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
              <li>{result.deleted?.squads || 0} squads</li>
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
            {wiping ? 'Wiping Data...' : 'Delete All Squad Data'}
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
          After wiping, you can create new squads with proper coordinates for radius search.
        </p>
      </div>
    </div>
  );
}
