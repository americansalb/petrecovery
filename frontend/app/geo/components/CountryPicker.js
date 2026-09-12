'use client';

/**
 * Country streak input: type a few letters, pick with the arrows or the
 * mouse, submit with Enter. Lists every country the picker knows, with
 * the ones that have imagery first.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export default function CountryPicker({ countries = [], value, onChange, onSubmit, disabled, provider = 'google' }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = countries.slice().sort((a, b) => Number(Boolean(b[provider])) - Number(Boolean(a[provider])) || a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 60);
    const starts = sorted.filter((c) => c.name.toLowerCase().startsWith(q) || c.code.toLowerCase() === q);
    const contains = sorted.filter((c) => !starts.includes(c) && c.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 60);
  }, [countries, query, provider]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children?.[active];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const choose = (country) => {
    onChange?.(country.code);
    setQuery(country.name);
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const exact = matches.find((c) => c.name.toLowerCase() === query.trim().toLowerCase());
      const pick = exact || matches[active];
      if (!pick) return;
      if (value === pick.code) onSubmit?.();
      else choose(pick);
    }
  };

  const selected = countries.find((c) => c.code === value);

  return (
    <div className="flex h-full flex-col">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Which country is this?"
          className="w-full rounded-xl border border-white/15 py-2.5 pl-9 pr-3 text-sm placeholder:text-white/40 focus:border-flash-400 focus:outline-none"
          // globals.css paints every input white for the light pages; this one sits on the dark HUD
          style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', color: '#ffffff' }}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label="Country"
        />
      </label>
      <ul ref={listRef} className="mt-2 flex-1 space-y-0.5 overflow-y-auto pr-1" role="listbox" aria-label="Countries">
        {matches.map((country, i) => (
          <li key={country.code} role="option" aria-selected={value === country.code}>
            <button
              type="button"
              onClick={() => choose(country)}
              onDoubleClick={() => {
                choose(country);
                onSubmit?.();
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${value === country.code ? 'bg-flash-400 text-midnight-900' : i === active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/10'}`}
            >
              <span className="w-6 text-base leading-none">{country.flag}</span>
              <span className="flex-1 truncate">{country.name}</span>
              {!country[provider] ? <span className="text-[10px] uppercase tracking-wide opacity-60">no imagery</span> : null}
            </button>
          </li>
        ))}
        {!matches.length ? <li className="px-2 py-2 text-sm text-white/60">No country matches that.</li> : null}
      </ul>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!selected || disabled}
        className="mt-2 w-full rounded-xl bg-flash-400 py-3 text-sm font-bold text-midnight-900 transition hover:bg-flash-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {selected ? `Guess ${selected.flag} ${selected.name}` : 'Pick a country'}
      </button>
    </div>
  );
}
