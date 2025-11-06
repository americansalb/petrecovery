import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(to bottom, #f0f9ff, #e0f2fe)',
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '2rem',
        color: '#1e40af',
        maxWidth: '800px',
      }}>
        Lost Your Pet? We'll Help You Get Them Back
      </h1>

      <Link
        href="/report/new"
        style={{
          backgroundColor: '#2563eb',
          color: 'white',
          fontSize: '1.25rem',
          fontWeight: '600',
          padding: '1rem 2rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        My Pet Is Missing
      </Link>
    </main>
  );
}
