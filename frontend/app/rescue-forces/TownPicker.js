'use client';

/**
 * A town field that suggests real towns as you type (/api/cities/suggest),
 * as an accessible combobox: arrow keys move, Enter picks, Escape closes.
 * Used by the Rescue Forces search and by "Start a Rescue Force", so both
 * know exactly which Austin is meant, and towns outside the US come with
 * the coordinates the forces API needs for them.
 *
 * `onPick(suggestion)` receives { city, state_id, country, zips, lat?, lng? }.
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

export function townLabel(s) {
  return [s.city, s.state_id].filter(Boolean).join(', ');
}

export default function TownPicker({ id, text, onTextChange, onPick, onEnter, placeholder = 'Town or ZIP code', autoFocus }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounce = useRef(null);
  const latest = useRef('');
  const listId = `${id}-list`;

  useEffect(() => {
    clearTimeout(debounce.current);
    const q = text.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    debounce.current = setTimeout(async () => {
      latest.current = q;
      try {
        const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (latest.current !== q) return;
        // The list can repeat a town (same name, state and country); show it once.
        const seen = new Set();
        setSuggestions(
          (data.suggestions || []).filter((s) => {
            const key = `${s.city}|${s.state_id}|${s.country}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
        );
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(debounce.current);
  }, [text]);

  function pick(s) {
    onTextChange(townLabel(s));
    setOpen(false);
    setActive(-1);
    onPick(s);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = active >= 0 ? suggestions[active] : suggestions.length === 1 ? suggestions[0] : null;
      if (chosen) pick(chosen);
      else if (onEnter) {
        setOpen(false);
        onEnter(suggestions);
      }
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && suggestions.length > 0 && text.trim().length >= 2;

  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-400" aria-hidden="true" />
      <input
        id={id}
        type="text"
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-midnight-200 bg-white py-3 pl-11 pr-3 text-midnight-900 placeholder:text-midnight-400 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-midnight-200">
          {suggestions.map((s, i) => (
            <li
              key={`${s.city}-${s.state_id}-${s.country}`}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 text-midnight-800 ${i === active ? 'bg-midnight-50' : 'hover:bg-midnight-50'}`}
            >
              <MapPin size={15} className="shrink-0 text-midnight-400" aria-hidden="true" />
              <span className="truncate">{townLabel(s)}</span>
              {s.country && s.country !== 'US' && <span className="ml-auto text-xs text-midnight-400">{s.country}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
