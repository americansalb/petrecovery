/**
 * Shared constants + variant theming for the report wizards
 * (/report/new and /report/found).
 *
 * Every Tailwind class lives here as a literal string so the JIT scanner
 * picks it up — never build class names dynamically from these values.
 */

import { Dog, Cat, Bird, Rabbit, PawPrint, Home, Trees } from 'lucide-react';

export const WIZARD_THEMES = {
  lost: {
    stamp: 'LOST',
    stampChip: 'bg-red-500 text-white',
    stampOutline: 'border-red-500 text-red-600',
    accentText: 'text-red-500',
    accentBg: 'bg-red-500',
    softBg: 'bg-red-50',
    softBorder: 'border-red-200',
    selectedCard: 'border-red-400 bg-red-50 ring-1 ring-red-400',
    postCta:
      'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-200 hover:shadow-xl',
    progressFill: 'bg-red-500',
    posterGrad: 'bg-gradient-to-br from-red-400 via-orange-400 to-amber-300',
    mapHex: '#ef4444',
    focusRing: 'focus:border-red-400 focus:ring-2 focus:ring-red-100',
  },
  found: {
    stamp: 'FOUND',
    stampChip: 'bg-emerald-500 text-white',
    stampOutline: 'border-emerald-500 text-emerald-600',
    accentText: 'text-emerald-600',
    accentBg: 'bg-emerald-500',
    softBg: 'bg-emerald-50',
    softBorder: 'border-emerald-200',
    selectedCard: 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400',
    postCta:
      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 hover:shadow-xl',
    progressFill: 'bg-emerald-500',
    posterGrad: 'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-300',
    mapHex: '#10b981',
    focusRing: 'focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100',
  },
};

export const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  other: PawPrint,
};

export const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Dog', icon: Dog },
  { value: 'cat', label: 'Cat', icon: Cat },
  { value: 'bird', label: 'Bird', icon: Bird },
  { value: 'rabbit', label: 'Rabbit', icon: Rabbit },
  { value: 'other', label: 'Other', icon: PawPrint },
];

export const DOG_SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', sublabel: 'Under 10 lbs · Chihuahua' },
  { value: 'SMALL', label: 'Small', sublabel: '10–25 lbs · Beagle' },
  { value: 'MEDIUM', label: 'Medium', sublabel: '25–60 lbs · Border Collie' },
  { value: 'LARGE', label: 'Large', sublabel: '60–90 lbs · Lab, Golden' },
  { value: 'GIANT', label: 'Giant', sublabel: 'Over 90 lbs · Great Dane' },
];

export const GENERIC_SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny' },
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
  { value: 'GIANT', label: 'Giant' },
];

export const CAT_LIVING_OPTIONS = [
  { value: 'indoor', label: 'Indoor only', sublabel: 'Never goes outside', icon: Home },
  { value: 'outdoor', label: 'Goes outside', sublabel: 'Has outdoor access', icon: Trees },
];

// Values are the exact enum both report APIs map through
// calculateLastSeenTime / calculateFoundTime — do not rename.
export const LOST_TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Within the last hour', sublabel: 'They may still be close', urgent: true },
  { value: '1_to_6_hours', label: 'A few hours ago', sublabel: '1–6 hours', urgent: true },
  { value: '6_to_24_hours', label: 'Earlier today', sublabel: '6–24 hours' },
  { value: '1_to_3_days', label: 'A day or two ago', sublabel: '1–3 days' },
  { value: '3_to_7_days', label: 'This week', sublabel: '3–7 days' },
  { value: 'more_than_2_weeks', label: 'Longer than a week', sublabel: 'Still worth reporting' },
];

export const FOUND_TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Just now', sublabel: 'Within the hour', urgent: true },
  { value: '1_to_6_hours', label: 'A few hours ago', sublabel: '1–6 hours' },
  { value: '6_to_24_hours', label: 'Earlier today', sublabel: '6–24 hours' },
  { value: '1_to_3_days', label: 'A day or two ago', sublabel: '1–3 days' },
];

export const ESCAPE_OPTIONS = [
  { value: 'door_dashed', label: 'Dashed out a door' },
  { value: 'jumped_fence', label: 'Jumped a fence' },
  { value: 'off_leash', label: 'Slipped the leash' },
  { value: 'spooked', label: 'Spooked / fireworks' },
  { value: 'unknown', label: 'Not sure' },
];

export function speciesToApi(species) {
  return (species || 'other').toUpperCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

export function isValidPhone(phone) {
  return (phone || '').replace(/\D/g, '').length >= 10;
}
