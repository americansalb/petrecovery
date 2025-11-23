'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateCasePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    // Pet Information
    petName: '',
    petSpecies: 'DOG',
    petBreed: '',
    petColor: '',
    petSize: 'MEDIUM',
    petPhotoUrl: '',
    petDescription: '',

    // Location
    lastSeenAt: '',
    lastSeenAddress: '',
    lastSeenLatitude: '',
    lastSeenLongitude: '',
    searchRadius: '5',

    // Incident
    escapeScenario: '',
    escapeDetails: '',

    // Contact
    ownerPhone: '',
    ownerEmail: session?.user?.email || '',

    // Optional
    hasReward: false,
    rewardAmount: '',
    priority: 'NORMAL'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLocationLookup = async () => {
    if (!formData.lastSeenAddress) {
      alert('Please enter an address first');
      return;
    }

    try {
      // Use a geocoding service to get coordinates
      // For now, we'll prompt the user to click on a map or enter coordinates manually
      const lat = prompt('Enter latitude (click on map or use GPS):');
      const lng = prompt('Enter longitude:');

      if (lat && lng) {
        setFormData(prev => ({
          ...prev,
          lastSeenLatitude: lat,
          lastSeenLongitude: lng
        }));
      }
    } catch (err) {
      console.error('Error looking up location:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.petName || !formData.petColor || !formData.petPhotoUrl || !formData.petDescription) {
        throw new Error('Please fill in all pet information');
      }

      if (!formData.lastSeenAt || !formData.lastSeenAddress || !formData.lastSeenLatitude || !formData.lastSeenLongitude) {
        throw new Error('Please fill in all location information');
      }

      if (!formData.escapeScenario || !formData.ownerPhone || !formData.ownerEmail) {
        throw new Error('Please fill in all required case details');
      }

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create case');
      }

      const data = await res.json();

      // Redirect to the new case page
      router.push(`/cases/${data.case.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (!session) {
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
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Sign In Required</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            You need to be signed in to report a lost pet
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700'
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '3rem 1rem'
    }}>
      <div style={{
        maxWidth: '800px',
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
            🐾 Report Lost Pet
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b'
          }}>
            Fill out the details below to create a case and alert nearby rescue squads
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #dc2626',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '2rem',
            color: '#991b1b'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Pet Information Section */}
          <div style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Pet Information
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Pet Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="petName"
                  value={formData.petName}
                  onChange={handleChange}
                  required
                  placeholder="Max, Bella, etc."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Species <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="petSpecies"
                    value={formData.petSpecies}
                    onChange={handleChange}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  >
                    <option value="DOG">Dog</option>
                    <option value="CAT">Cat</option>
                    <option value="BIRD">Bird</option>
                    <option value="RABBIT">Rabbit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Size <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="petSize"
                    value={formData.petSize}
                    onChange={handleChange}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  >
                    <option value="TINY">Tiny (&lt; 10 lbs)</option>
                    <option value="SMALL">Small (10-25 lbs)</option>
                    <option value="MEDIUM">Medium (25-60 lbs)</option>
                    <option value="LARGE">Large (60-90 lbs)</option>
                    <option value="GIANT">Giant (&gt; 90 lbs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Breed
                </label>
                <input
                  type="text"
                  name="petBreed"
                  value={formData.petBreed}
                  onChange={handleChange}
                  placeholder="Golden Retriever, Tabby, etc."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Color/Markings <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="petColor"
                  value={formData.petColor}
                  onChange={handleChange}
                  required
                  placeholder="Brown with white chest, Orange tabby, etc."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Photo URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="url"
                  name="petPhotoUrl"
                  value={formData.petPhotoUrl}
                  onChange={handleChange}
                  required
                  placeholder="https://example.com/pet-photo.jpg"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Upload your photo to a service like Imgur or Google Photos and paste the URL here
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  name="petDescription"
                  value={formData.petDescription}
                  onChange={handleChange}
                  required
                  placeholder="Detailed description including unique features, behavior, collar info, etc."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Last Seen Location
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Date & Time <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  name="lastSeenAt"
                  value={formData.lastSeenAt}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="lastSeenAddress"
                  value={formData.lastSeenAddress}
                  onChange={handleChange}
                  required
                  placeholder="123 Main St, Chicago, IL 60601"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Latitude <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="lastSeenLatitude"
                    value={formData.lastSeenLatitude}
                    onChange={handleChange}
                    required
                    placeholder="41.8781"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Longitude <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="lastSeenLongitude"
                    value={formData.lastSeenLongitude}
                    onChange={handleChange}
                    required
                    placeholder="-87.6298"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Search Radius (miles)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    name="searchRadius"
                    value={formData.searchRadius}
                    onChange={handleChange}
                    placeholder="5"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                💡 Tip: Use Google Maps to find coordinates. Right-click on the location and select the coordinates to copy them.
              </p>
            </div>
          </div>

          {/* Incident Details */}
          <div style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Incident Details
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  How did they escape? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  name="escapeScenario"
                  value={formData.escapeScenario}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="DOOR_DASH">Bolted out the door</option>
                  <option value="FENCE_JUMP">Jumped/climbed fence</option>
                  <option value="DIG_UNDER">Dug under fence</option>
                  <option value="BROKE_LEASH">Broke off leash</option>
                  <option value="SLIPPED_COLLAR">Slipped collar</option>
                  <option value="WINDOW">Escaped through window</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Additional Details
                </label>
                <textarea
                  name="escapeDetails"
                  value={formData.escapeDetails}
                  onChange={handleChange}
                  placeholder="Any additional information about the escape, where they might have gone, etc."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                >
                  <option value="LOW">Low - Healthy adult pet, good weather</option>
                  <option value="NORMAL">Normal - Standard case</option>
                  <option value="HIGH">High - Medical needs, extreme weather</option>
                  <option value="URGENT">Urgent - Life-threatening situation</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '2px solid #e2e8f0'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Contact Information
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  name="ownerPhone"
                  value={formData.ownerPhone}
                  onChange={handleChange}
                  required
                  placeholder="(555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  name="ownerEmail"
                  value={formData.ownerEmail}
                  onChange={handleChange}
                  required
                  placeholder="owner@example.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Reward Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              marginBottom: '1.5rem'
            }}>
              Reward (Optional)
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '700',
                  color: '#0f172a'
                }}>
                  <input
                    type="checkbox"
                    name="hasReward"
                    checked={formData.hasReward}
                    onChange={handleChange}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  Offering a reward
                </label>
              </div>

              {formData.hasReward && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#0f172a' }}>
                    Reward Amount ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    name="rewardAmount"
                    value={formData.rewardAmount}
                    onChange={handleChange}
                    placeholder="500"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <Link
              href="/dashboard"
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
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: submitting ? '#cbd5e1' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
            >
              {submitting ? 'Creating Case...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
