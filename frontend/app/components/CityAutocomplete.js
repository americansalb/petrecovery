'use client';

/**
 * City + state autocomplete over the /api/geocode Nominatim proxy: the
 * same debounced dropdown pattern as the admin group sweep. Controlled:
 * value = { city, state, lat, lng } | null. Free typing clears the
 * validated pick, so callers can require a real selection.
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { normalizeState } from '@/app/lib/usStates';

export default function CityAutocomplete({ value, onChange, placeholder = 'Start typing your city…', inputClassName = '' }) {
  const [query, setQuery] = useState(value ? `${value.city}, ${value.state}` : '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = (q) => {
    setQuery(q);
    onChange(null); // typing invalidates the previous pick
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: '6',
          addressdetails: '1',
          countrycodes: 'us',
        });
        const res = await fetch(`/api/geocode?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const seen = new Set();
        const opts = (Array.isArray(data) ? data : [])
          .map((r) => {
            const a = r.address || {};
            const city = a.city || a.town || a.village || a.municipality || '';
            const state = normalizeState(a.state || '');
            const lat = parseFloat(r.lat);
            const lng = parseFloat(r.lon);
            return city
              ? { city, state, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null }
              : null;
          })
          .filter(Boolean)
          .filter((o) => {
            const k = `${o.city}|${o.state}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        setOptions(opts);
        setOpen(opts.length > 0);
      } catch {
        // Geocoder hiccup: the field still works as free text.
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const pick = (opt) => {
    onChange(opt);
    setQuery(`${opt.city}, ${opt.state}`);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => options.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="w-4 h-4 animate-spin text-midnight-400 absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {open && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-midnight-200 rounded-xl overflow-hidden shadow-lg">
          {options.map((o) => (
            <li key={`${o.city}|${o.state}`}>
              <button
                type="button"
                onClick={() => pick(o)}
                className="w-full text-left px-3.5 py-2.5 text-sm text-midnight-800 hover:bg-flash-50 flex items-center gap-2 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                {o.city}, {o.state}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
