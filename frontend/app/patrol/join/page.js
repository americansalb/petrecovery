'use client';

/**
 * /patrol/join - sign up to watch a neighborhood for lost pets.
 *
 * Three steps: pick the zone (zip or geolocation, then drag the pin and set
 * the radius), choose how alerts arrive, agree to the safety rules. Guests
 * create an account inline; the POST /api/patrol/join contract is unchanged
 * (zipCode, centerLat/Lng, radiusMiles, notifications{text,email,push}).
 */

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  MapPin, Bell, ShieldCheck, Loader2, Check, ChevronLeft, Navigation,
} from 'lucide-react';
import { captchaHeaders } from '@/app/lib/captchaClient';

const STEPS = [
  { id: 'zone', label: 'Your zone' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'agree', label: 'Agreement' },
];

const inputClass =
  'w-full px-4 py-3 rounded-xl border-2 border-midnight-200 text-midnight-900 ' +
  'placeholder:text-midnight-400 focus:outline-none focus:border-flash-400 transition-colors';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-flash-400 ' +
  'text-midnight-900 font-bold enabled:hover:bg-flash-500 disabled:bg-midnight-200 ' +
  'disabled:text-midnight-500 disabled:cursor-not-allowed transition-colors';

const quietBtn =
  'inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-midnight-600 font-medium ' +
  'hover:text-midnight-900 hover:bg-midnight-100 transition-colors';

export default function JoinPatrol() {
  const { data: session, status } = useSession();

  const [step, setStep] = useState(0);
  const [zipCode, setZipCode] = useState('');
  const [zoneLabel, setZoneLabel] = useState('');
  const [center, setCenter] = useState(null); // [lat, lng]
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [locating, setLocating] = useState(false);
  const [notifications, setNotifications] = useState({ text: true, email: true, push: true });
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);
  const [accountInfo, setAccountInfo] = useState({
    firstName: '', phone: '', email: '', password: '', confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(null); // email awaiting verification
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // People who already patrol get their settings, not a second signup.
  useEffect(() => {
    async function checkPatrolStatus() {
      if (status === 'authenticated' && session?.user) {
        try {
          const res = await fetch('/api/profile');
          if (res.ok) {
            const data = await res.json();
            if (data.patrolProfile) setAlreadyMember(true);
          }
        } catch (err) {
          console.error('Error checking patrol status:', err);
        }
      }
      setCheckingStatus(false);
    }
    if (status !== 'loading') checkPatrolStatus();
  }, [status, session]);

  // The zone draft survives leaving the page (signing in, verifying an
  // email). Restored on return, cleared on success.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('patrolZoneDraft');
      if (saved) {
        const d = JSON.parse(saved);
        if (Array.isArray(d.center) && Number.isFinite(d.center[0])) setCenter(d.center);
        if (typeof d.zipCode === 'string') setZipCode(d.zipCode);
        if (typeof d.zoneLabel === 'string') setZoneLabel(d.zoneLabel);
        if (Number.isFinite(d.radiusMiles)) setRadiusMiles(d.radiusMiles);
        if (d.notifications) setNotifications((n) => ({ ...n, ...d.notifications }));
      }
    } catch { /* no draft */ }
  }, []);

  useEffect(() => {
    if (!center) return;
    try {
      localStorage.setItem(
        'patrolZoneDraft',
        JSON.stringify({ zipCode, center, zoneLabel, radiusMiles, notifications })
      );
    } catch { /* storage full/blocked - non-fatal */ }
  }, [zipCode, center, zoneLabel, radiusMiles, notifications]);

  // Map lives on the zone step once a center exists.
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center || step !== 0) {
      if ((step !== 0 || !center) && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
      return;
    }
    if (mapInstanceRef.current) return;

    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const L = mod.default || mod;
      const map = L.map(mapRef.current, { zoomControl: true }).setView(center, 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(center, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#facc15;border:3px solid #020617;transform:rotate(-45deg);"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 24],
        }),
      }).addTo(map);
      const circle = L.circle(center, {
        radius: radiusMiles * 1609.34,
        color: '#020617',
        weight: 2,
        fillColor: '#facc15',
        fillOpacity: 0.12,
      }).addTo(map);

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, center === null, checkingStatus]);

  useEffect(() => {
    if (markerRef.current && circleRef.current && center) {
      markerRef.current.setLatLng(center);
      circleRef.current.setLatLng(center);
    }
  }, [center]);

  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radiusMiles * 1609.34);
  }, [radiusMiles]);

  const geocodeZip = async () => {
    setError(null);
    if (!/^\d{5}$/.test(zipCode)) {
      setError('Enter a 5-digit ZIP code.');
      return;
    }
    setLocating(true);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(zipCode + ' USA')}&limit=1&addressdetails=1&countrycodes=us`
      );
      const data = res.ok ? await res.json() : [];
      if (Array.isArray(data) && data.length > 0) {
        const a = data[0].address || {};
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setZoneLabel([a.city || a.town || a.village || a.suburb, a.state].filter(Boolean).join(', '));
      } else {
        setError("Couldn't place that ZIP code on the map. Check the number, or use your location instead.");
      }
    } catch {
      setError("The map lookup isn't responding. Use your location instead, or try again in a minute.");
    } finally {
      setLocating(false);
    }
  };

  const useMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser can't share your location. Enter your ZIP code instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        setZoneLabel('Your current location');
        // The join API stores the zone by ZIP as well - pull it from a
        // reverse lookup so the person doesn't have to type it.
        try {
          const res = await fetch(`/api/geocode?lat=${c[0]}&lon=${c[1]}&addressdetails=1`);
          if (res.ok) {
            const data = await res.json();
            const a = data?.address || {};
            if (/^\d{5}/.test(a.postcode || '')) setZipCode(a.postcode.slice(0, 5));
            const label = [a.suburb || a.neighbourhood || a.city || a.town, a.state].filter(Boolean).join(', ');
            if (label) setZoneLabel(label);
          }
        } catch { /* the map pin is set; zip can be typed */ }
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Enter your ZIP code instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (status !== 'authenticated') {
        if (!accountInfo.firstName || !accountInfo.email || !accountInfo.password) {
          throw new Error('Fill in your name, email, and a password to create the account.');
        }
        if (accountInfo.password !== accountInfo.confirmPassword) {
          throw new Error('The two passwords do not match.');
        }
        if (accountInfo.password.length < 8) {
          throw new Error('The password needs at least 8 characters.');
        }
        const registerRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('register')) },
          body: JSON.stringify({
            email: accountInfo.email,
            password: accountInfo.password,
            firstName: accountInfo.firstName,
            phone: accountInfo.phone,
          }),
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) throw new Error(registerData.error || 'Could not create the account.');

        const signInResult = await signIn('credentials', {
          redirect: false,
          email: accountInfo.email,
          password: accountInfo.password,
        });
        if (signInResult?.error) {
          // New accounts can't sign in until the email is verified. The
          // zone draft is already saved on this device, so hand off to
          // verification instead of showing a dead-end error.
          setVerifyEmail(accountInfo.email);
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch('/api/patrol/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipCode,
          centerLat: center[0],
          centerLng: center[1],
          radiusMiles,
          notifications,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your patrol zone.');
      try { localStorage.removeItem('patrolZoneDraft'); } catch { /* non-fatal */ }
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-midnight-50">
        <Loader2 size={32} className="animate-spin text-midnight-400" />
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-[70vh] bg-midnight-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card p-8 text-center">
          <span className="w-14 h-14 mx-auto rounded-full bg-flash-100 flex items-center justify-center mb-4">
            <ShieldCheck size={28} className="text-midnight-900" />
          </span>
          <h1 className="text-2xl font-bold text-midnight-900 mb-2">You already patrol</h1>
          <p className="text-midnight-600 mb-6">
            This account has a patrol zone. Alerts for missing pets inside it go to you already.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard" className={primaryBtn}>Go to my dashboard</Link>
            <Link href="/profile" className={quietBtn + ' justify-center'}>Change my patrol settings</Link>
          </div>
        </div>
      </div>
    );
  }

  if (verifyEmail) {
    return (
      <div className="min-h-[70vh] bg-midnight-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card p-8 text-center">
          <span className="w-14 h-14 mx-auto rounded-full bg-flash-100 flex items-center justify-center mb-4">
            <Bell size={28} className="text-midnight-900" />
          </span>
          <h1 className="text-2xl font-bold text-midnight-900 mb-2">Check your email</h1>
          <p className="text-midnight-600 mb-6">
            Your account is created and a verification link is on its way to{' '}
            <strong className="text-midnight-900">{verifyEmail}</strong>. Your patrol zone is saved on
            this device: verify, sign in, and finish from this page with one tap.
          </p>
          <Link href="/login?callbackUrl=/patrol/join" className={primaryBtn}>
            I verified - sign me in
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[70vh] bg-midnight-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card p-8 text-center">
          <span className="w-14 h-14 mx-auto rounded-full bg-flash-400 flex items-center justify-center mb-4">
            <Check size={28} strokeWidth={3} className="text-midnight-900" />
          </span>
          <h1 className="text-2xl font-bold text-midnight-900 mb-2">Your zone is active</h1>
          <p className="text-midnight-600 mb-6">
            When a pet is reported missing within {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'} of
            your pin, you get an alert. Keep an eye out on your normal walks and drives, and report any
            sighting from the alert itself.
          </p>
          <Link href="/dashboard" className={primaryBtn}>Go to my dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-50">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-midnight-900">Pet Patrol</h1>
          <p className="text-midnight-600 mt-2">
            Pick the area you already move through every day. When a pet goes missing inside it,
            you get an alert with the photo and the spot it was last seen.
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < step ? 'bg-midnight-900 text-white'
                  : i === step ? 'bg-flash-400 text-midnight-900'
                  : 'bg-midnight-200 text-midnight-500'
                }`}
              >
                {i < step ? <Check size={16} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-sm font-medium hidden sm:inline ${i === step ? 'text-midnight-900' : 'text-midnight-400'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-midnight-200" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-card p-6 sm:p-8">
          {/* Step 1: zone */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-midnight-900 mb-1 flex items-center gap-2">
                <MapPin size={20} /> Where you patrol
              </h2>
              <p className="text-midnight-600 text-sm mb-5">
                Start from your ZIP code, then drag the pin and set how far around it you can keep an eye on.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') geocodeZip(); }}
                  placeholder="ZIP code"
                  className={inputClass + ' flex-1'}
                  aria-label="ZIP code"
                />
                <button type="button" onClick={geocodeZip} disabled={locating} className={primaryBtn}>
                  {locating ? <Loader2 size={18} className="animate-spin" /> : 'Find it'}
                </button>
              </div>
              <button type="button" onClick={useMyLocation} disabled={locating} className={quietBtn + ' mt-2 text-sm'}>
                <Navigation size={15} /> Use my location instead
              </button>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              {center && (
                <div className="mt-5">
                  {zoneLabel && (
                    <p className="text-sm font-medium text-midnight-900 mb-2">{zoneLabel}</p>
                  )}
                  <div ref={mapRef} className="h-64 rounded-2xl overflow-hidden border border-midnight-200" />
                  <p className="text-xs text-midnight-500 mt-2">Drag the pin to the middle of your area.</p>

                  <label className="block mt-4 text-sm font-medium text-midnight-900">
                    Radius: {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}
                    <input
                      type="range"
                      min={1}
                      max={25}
                      step={1}
                      value={radiusMiles}
                      onChange={(e) => setRadiusMiles(Number(e.target.value))}
                      className="w-full mt-2 accent-flash-400"
                    />
                  </label>
                  <div className="flex justify-between text-xs text-midnight-400">
                    <span>1 mile</span><span>25 miles</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep(1); }}
                  disabled={!center || !/^\d{5}$/.test(zipCode)}
                  className={primaryBtn}
                >
                  Continue
                </button>
              </div>
              {!center ? (
                <p className="text-xs text-midnight-500 text-right mt-2">Place your zone on the map to continue.</p>
              ) : !/^\d{5}$/.test(zipCode) ? (
                <p className="text-xs text-midnight-500 text-right mt-2">Add your ZIP code above to continue.</p>
              ) : null}
            </div>
          )}

          {/* Step 2: alerts */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-midnight-900 mb-1 flex items-center gap-2">
                <Bell size={20} /> How alerts reach you
              </h2>
              <p className="text-midnight-600 text-sm mb-5">
                When a pet is reported missing inside your zone, we send the photo and last-seen spot.
              </p>

              {[
                { key: 'text', label: 'Text message', desc: 'A text to the phone number on your account.' },
                { key: 'email', label: 'Email', desc: 'The full report in your inbox.' },
                { key: 'push', label: 'Push notification', desc: 'On this device, when the app is installed.' },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 border-midnight-100 hover:border-midnight-300 cursor-pointer mb-3 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={notifications[opt.key]}
                    onChange={(e) => setNotifications((n) => ({ ...n, [opt.key]: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-flash-400"
                  />
                  <span>
                    <span className="block font-semibold text-midnight-900">{opt.label}</span>
                    <span className="block text-sm text-midnight-500">{opt.desc}</span>
                  </span>
                </label>
              ))}

              <div className="flex justify-between mt-6">
                <button type="button" onClick={() => setStep(0)} className={quietBtn}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="button" onClick={() => { setError(null); setStep(2); }} className={primaryBtn}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: safety rules, waiver, account, submit */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-midnight-900 mb-1 flex items-center gap-2">
                <ShieldCheck size={20} /> The rules, then you&apos;re in
              </h2>
              <p className="text-midnight-600 text-sm mb-5">
                Patrol means watching and reporting. It never means catching.
              </p>

              <div className="bg-flash-50 border border-flash-200 rounded-xl p-4 mb-4">
                <p className="font-semibold text-midnight-900 mb-2">Safety rules</p>
                <ul className="text-sm text-midnight-700 space-y-1.5 list-disc pl-5">
                  <li>Do not approach animals that may attack humans or harbor disease.</li>
                  <li>Contact animal control or owners when appropriate. Never take direct action with aggressive animals.</li>
                  <li>Never enter private property without permission.</li>
                  <li>Report sightings only. You are not expected to capture or chase animals.</li>
                  <li>Your safety comes first. If you feel unsafe, do not engage.</li>
                </ul>
              </div>

              <div className="border border-midnight-200 rounded-xl p-4 mb-4 max-h-64 overflow-y-auto text-sm text-midnight-600">
                <p className="font-semibold text-midnight-900 mb-2">Liability waiver</p>
                <p>
                  By joining the ReunitePets Patrol, you acknowledge and agree that:
                  <br /><br />
                  <strong>1. Voluntary Participation:</strong> Your participation in the ReunitePets Patrol program is entirely voluntary. You are not required to take any action beyond reporting sightings of lost pets.
                  <br /><br />
                  <strong>2. No Guarantee of Safety:</strong> ReunitePets.org makes no guarantees regarding your safety while participating in patrol activities. You assume all risks associated with looking for, observing, or reporting lost pets.
                  <br /><br />
                  <strong>3. Release of Liability:</strong> You release, waive, discharge, and covenant not to sue ReunitePets.org, its officers, employees, and agents from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury that may be sustained by you while participating in the patrol program.
                  <br /><br />
                  <strong>4. Assumption of Risk:</strong> You acknowledge that participation in the patrol program involves inherent risks including, but not limited to, animal bites, scratches, disease transmission, property disputes, and traffic hazards. You expressly assume all such risks.
                  <br /><br />
                  <strong>5. Compliance with Laws:</strong> You agree to comply with all local, state, and federal laws while participating in the patrol program, including trespassing and animal control laws.
                  <br /><br />
                  <strong>6. Indemnification:</strong> You agree to indemnify and hold harmless ReunitePets.org from any claims, damages, or expenses arising from your participation in the patrol program.
                </p>
              </div>

              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToWaiver}
                  onChange={(e) => setAgreedToWaiver(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-flash-400"
                />
                <span className="text-sm text-midnight-700">
                  I have read the safety rules and the waiver, and I agree to both.
                </span>
              </label>

              {status !== 'authenticated' && (
                <div className="border-t border-midnight-100 pt-5 mb-6">
                  <p className="font-semibold text-midnight-900 mb-1">Create your account</p>
                  <p className="text-sm text-midnight-500 mb-4">
                    Alerts need somewhere to go. Free, no card.{' '}
                    <Link href="/login?callbackUrl=/patrol/join" className="font-semibold text-midnight-900 hover:text-flash-600">
                      Already have one? Sign in
                    </Link>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className={inputClass} placeholder="First name" value={accountInfo.firstName}
                      onChange={(e) => setAccountInfo((a) => ({ ...a, firstName: e.target.value }))} aria-label="First name" />
                    <input className={inputClass} placeholder="Phone (for text alerts)" type="tel" value={accountInfo.phone}
                      onChange={(e) => setAccountInfo((a) => ({ ...a, phone: e.target.value }))} aria-label="Phone" />
                    <input className={inputClass + ' sm:col-span-2'} placeholder="Email" type="email" value={accountInfo.email}
                      onChange={(e) => setAccountInfo((a) => ({ ...a, email: e.target.value }))} aria-label="Email" />
                    <input className={inputClass} placeholder="Password (8+ characters)" type="password" value={accountInfo.password}
                      onChange={(e) => setAccountInfo((a) => ({ ...a, password: e.target.value }))} aria-label="Password" />
                    <input className={inputClass} placeholder="Confirm password" type="password" value={accountInfo.confirmPassword}
                      onChange={(e) => setAccountInfo((a) => ({ ...a, confirmPassword: e.target.value }))} aria-label="Confirm password" />
                  </div>
                </div>
              )}

              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className={quietBtn}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={!agreedToWaiver || isSubmitting} className={primaryBtn}>
                  {isSubmitting ? (<><Loader2 size={18} className="animate-spin" /> Joining...</>) : 'Join the patrol'}
                </button>
              </div>
              {!agreedToWaiver && (
                <p className="text-xs text-midnight-500 text-right mt-2">Tick the agreement box to join.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
