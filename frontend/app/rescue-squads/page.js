'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RescueSquadsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/rescue-squads/search');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚁</div>
        <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Redirecting...</div>
      </div>
    </div>
  );
}
