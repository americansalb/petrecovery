/**
 * ReunitePets design tokens. Pulled from the website's brand (Tailwind):
 *   midnight — the slate/navy neutral scale (text, surfaces, dark mode)
 *   flash    — the gold accent (#facc15)
 * Keep the semantic keys identical across light/dark so themed components
 * (ThemedText/ThemedView) stay type-safe.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0f172a', // midnight-900
    textSecondary: '#64748b', // midnight-500
    background: '#ffffff',
    backgroundElement: '#f1f5f9', // midnight-100
    backgroundSelected: '#e2e8f0', // midnight-200
    border: '#e2e8f0', // midnight-200
    card: '#ffffff',
    tint: '#0f172a', // active nav / interactive
    accent: '#facc15', // flash-400
    accentText: '#0f172a',
    primary: '#0f172a',
    onPrimary: '#ffffff',
    danger: '#dc2626',
    success: '#16a34a',
    muted: '#94a3b8', // midnight-400
  },
  dark: {
    text: '#f8fafc', // midnight-50
    textSecondary: '#94a3b8', // midnight-400
    background: '#020617', // midnight-950
    backgroundElement: '#0f172a', // midnight-900
    backgroundSelected: '#1e293b', // midnight-800
    border: '#1e293b', // midnight-800
    card: '#0f172a',
    tint: '#facc15', // gold pops in dark
    accent: '#facc15',
    accentText: '#0f172a',
    primary: '#facc15',
    onPrimary: '#0f172a',
    danger: '#f87171',
    success: '#4ade80',
    muted: '#475569',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
