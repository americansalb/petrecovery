'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function CreateSquadPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        city: '',
        state: '',
        zipCodes: '',
        radiusMiles: 5,
        specializesInDogs: true,
        specializesInCats: true,
    });

    if (status === 'loading') return <div>Loading...</div>;

    if (!session) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Sign in Required</h2>
                    <p style={{ marginBottom: '2rem', color: '#64748b' }}>You must be signed in to create a Rescue Squad.</p>
                    <Link href="/login" style={{ padding: '0.75rem 1.5rem', background: '#0f172a', color: 'white', borderRadius: '8px', textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/rescue-squads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    zipCodes: formData.zipCodes.split(',').map(z => z.trim()).filter(z => z),
                    radiusMiles: parseInt(formData.radiusMiles),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create squad');
            }

            const squad = await res.json();
            router.push(`/rescue-squads/${squad.id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <Link href="/rescue-squads" style={{ textDecoration: 'none', color: '#64748b', display: 'inline-block', marginBottom: '1rem' }}>
                    ← Back to Search
                </Link>

                <div style={{ background: 'white', padding: '3rem', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
                        Create a Rescue Squad
                    </h1>
                    <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                        Start a new volunteer team to coordinate searches in your area.
                    </p>

                    {error && (
                        <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '2rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>Squad Name</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Lincoln Park Pet Finders"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>Description</label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Tell us about your squad's mission..."
                                rows={4}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>City</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>State (2 letters)</label>
                                <input
                                    required
                                    type="text"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>ZIP Codes Served (comma separated)</label>
                            <input
                                required
                                type="text"
                                value={formData.zipCodes}
                                onChange={e => setFormData({ ...formData, zipCodes: e.target.value })}
                                placeholder="60614, 60657, 60610"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>Coverage Radius (miles)</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={formData.radiusMiles}
                                onChange={e => setFormData({ ...formData, radiusMiles: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '2rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.specializesInDogs}
                                    onChange={e => setFormData({ ...formData, specializesInDogs: e.target.checked })}
                                />
                                <span>Specializes in Dogs</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.specializesInCats}
                                    onChange={e => setFormData({ ...formData, specializesInCats: e.target.checked })}
                                />
                                <span>Specializes in Cats</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#0f172a',
                                color: 'white',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '1.1rem',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? 'Creating Squad...' : 'Create Rescue Squad'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
