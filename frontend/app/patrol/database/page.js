'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PatrolDatabasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the public database page
    router.push('/database');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p>Redirecting to database...</p>
      </div>
    </div>
  );
}
