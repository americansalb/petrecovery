'use client';

/**
 * The door between worlds. One account can own animals, help run a
 * shelter, and ride with a rescue force; each is a different layout with
 * a different idea of what "pets" means. This picks which one you are
 * looking at.
 *
 * It changes PRESENTATION, never permission. Authority is re-derived from
 * the database inside every guarded route (docs/PERMISSIONS.md), so
 * choosing a mode you do not hold simply bounces you back out. That is
 * what keeps the hats from tangling: the switcher can be wrong without
 * being dangerous.
 *
 * Someone who only owns pets holds one mode and never sees this at all.
 *
 * (Not to be confused with the older components/ModeSwitcher.js, a
 * lost/found display toggle that nothing currently renders.)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, Building2, Shield, Check, ChevronDown } from 'lucide-react';

const ICONS = { owner: PawPrint, shelter: Building2, rescuer: Shield };

/** Remembered so the next sign-in lands where you left off. */
export function rememberMode(id) {
  try {
    document.cookie = `rp_mode=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch { /* cookies disabled: switching still works, it just forgets */ }
}

function useAccountModes() {
  const [modes, setModes] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/account/modes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setModes(d.modes || []); })
      .catch(() => { /* optional chrome: stay quiet */ });
    return () => { alive = false; };
  }, []);
  return modes;
}

/**
 * `variant` picks the surface: "menu" sits inside the consumer account
 * dropdown, "sidebar" sits in the portal's dark footer.
 */
export default function AccountModeSwitcher({ current, variant = 'menu', onNavigate }) {
  const router = useRouter();
  const modes = useAccountModes();
  const [open, setOpen] = useState(false);

  // Nothing to switch between: one hat, no menu.
  if (!modes || modes.length < 2) return null;

  const active = modes.find((m) => m.id === current) || modes[0];

  if (variant === 'sidebar') {
    const go = (mode) => {
      rememberMode(mode.id);
      setOpen(false);
      if (onNavigate) onNavigate();
      router.push(mode.href);
    };
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="w-full flex items-center gap-2 text-sm font-semibold text-midnight-200 hover:text-white transition-colors"
        >
          <span className="flex-1 text-left truncate">Switch view</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div role="menu" className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-white shadow-xl border border-midnight-100 overflow-hidden">
            {modes.map((m) => {
              const Icon = ICONS[m.id] || PawPrint;
              return (
                <button
                  key={m.id}
                  role="menuitem"
                  onClick={() => go(m)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition"
                >
                  <Icon className="w-4 h-4 text-midnight-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-midnight-900 truncate">{m.label}</span>
                    <span className="block text-[12px] text-midnight-400">{m.detail}</span>
                  </span>
                  {m.id === active.id && <Check className="w-4 h-4 text-flash-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-midnight-100">
      <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400">
        Switch view
      </p>
      {modes.map((m) => {
        const Icon = ICONS[m.id] || PawPrint;
        return (
          <Link
            key={m.id}
            href={m.href}
            onClick={() => { rememberMode(m.id); if (onNavigate) onNavigate(); }}
            className="flex items-center gap-3 px-4 py-2.5 text-midnight-700 hover:bg-midnight-50 transition"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{m.label}</span>
              <span className="block text-[12px] text-midnight-400">{m.detail}</span>
            </span>
            {m.id === active.id && <Check className="w-4 h-4 text-flash-600 shrink-0" />}
          </Link>
        );
      })}
    </div>
  );
}
