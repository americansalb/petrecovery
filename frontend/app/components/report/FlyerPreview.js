'use client';

/**
 * FlyerPreview - the flyer as a small picture of itself, drawn from the
 * report's answers: the lit yellow ground, the LOST band, the photo in its
 * cream mat, what to look for, "If you see Max", and the phone. It is the
 * same thing the renderers print (cascade/render/flyers), so the owner
 * sees what gets posted while they answer, on the review screen, and on
 * the page after posting.
 *
 * Sizes are in em from one root font size, so a width is the only knob:
 * 350px is the design size; the sidebar draws it at 288, a tile at 120.
 * With no width it fills its container and scales with the viewport.
 */

import { SPECIES_ICONS } from './wizardTheme';

const BASE_W = 350;
const INK = '#4a2512';
const CREAM = '#fffbea';
const LEMON = '#ffe566';
const YELLOW = '#facc15';
const AMBER = '#e4a30c';
const STAMP = {
  lost: { word: 'LOST', color: '#dc2626' },
  found: { word: 'FOUND', color: '#0284c7' },
};
const SPECIES_WORD = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit', OTHER: 'pet' };

export function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone || '';
}

const eyebrow = { fontSize: '0.5em', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.2 };
const stripe = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: '0.375em',
  background: `repeating-linear-gradient(45deg, ${INK} 0 0.5em, ${YELLOW} 0.5em 1em)`,
};

export default function FlyerPreview({
  variant = 'lost',
  species,
  petName,
  photoUrl,
  pills = [],
  when,
  where,
  lookFor,
  urgent, // the health line, read first
  approach, // the "If you see" line
  phone,
  email,
  link,
  width, // px; omit to fill the container
  className = '',
}) {
  const stamp = STAMP[variant] || STAMP.lost;
  const sp = String(species || 'OTHER').toUpperCase();
  const word = SPECIES_WORD[sp] || 'pet';
  const Icon = SPECIES_ICONS[word === 'pet' ? 'other' : word] || SPECIES_ICONS.other;
  const name = (petName || '').trim();
  const title = name ? `${name}, a ${word}` : `A ${word}`;
  const who = name || `this ${word}`;
  const seen = [when, where].filter(Boolean).join(', ');
  const phoneText = formatPhone(phone);
  const style = width
    ? { width, fontSize: `${(width / BASE_W) * 16}px` }
    : { width: '100%', fontSize: `min(16px, calc((100vw - 40px) * ${(16 / BASE_W).toFixed(5)}))` };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        borderRadius: '0.5em',
        background: `radial-gradient(circle at 50% 30%, ${LEMON} 0%, ${YELLOW} 45%, ${AMBER} 100%)`,
        color: INK,
        padding: '0.9em 0.75em 0.75em',
        fontFamily: 'inherit',
      }}
      role="img"
      aria-label={`${stamp.word} flyer for ${who}`}
    >
      <div style={{ ...stripe, top: 0 }} aria-hidden="true" />
      <div style={{ ...stripe, bottom: 0 }} aria-hidden="true" />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em', minWidth: 0 }}>
        <span
          style={{
            display: 'inline-block',
            background: stamp.color,
            color: CREAM,
            fontSize: '1.875em',
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            padding: '0.13em 0.33em 0.2em',
            borderRadius: '0.2em',
            transform: 'rotate(-2deg)',
            boxShadow: `0.1em 0.1em 0 ${INK}`,
            flex: '0 0 auto',
          }}
        >
          {stamp.word}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em', minWidth: 0 }}>
          <span style={{ fontSize: '1.125em', fontWeight: 800, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          {pills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
              {pills.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: '0.56em',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: stamp.color,
                    color: CREAM,
                    padding: '0.2em 0.6em',
                    borderRadius: '999px',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '0.5em', background: CREAM, borderRadius: '0.6em', padding: '0.3em', boxShadow: `0 0.12em 0 ${INK}` }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" style={{ display: 'block', width: '100%', height: '11.5em', objectFit: 'cover', borderRadius: '0.45em' }} />
        ) : (
          <div style={{ height: '7em', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4em', color: INK, opacity: 0.75 }}>
            <Icon style={{ width: '2.4em', height: '2.4em' }} strokeWidth={1.5} aria-hidden="true" />
            <span style={{ fontSize: '0.7em', fontWeight: 700 }}>The photo goes here</span>
          </div>
        )}
      </div>

      {seen && (
        <div style={{ marginTop: '0.5em', display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
          <span style={eyebrow}>{variant === 'found' ? 'Found' : 'Last seen'}</span>
          <span style={{ fontSize: '0.875em', fontWeight: 800, lineHeight: 1.2 }}>{seen}</span>
        </div>
      )}

      {lookFor && <p style={{ margin: '0.4em 0 0', fontSize: '0.75em', lineHeight: 1.35 }}>{lookFor}</p>}

      {(approach || urgent) && (
        <div style={{ marginTop: '0.5em', background: CREAM, borderRadius: '0.5em', padding: '0.45em 0.55em', display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
          <span style={eyebrow}>{variant === 'found' ? `Is this your ${word}?` : `If you see ${who}`}</span>
          {urgent && <p style={{ margin: 0, fontSize: '0.7em', lineHeight: 1.3, fontWeight: 800, color: '#b91c1c' }}>{urgent}</p>}
          {approach && <p style={{ margin: 0, fontSize: '0.7em', lineHeight: 1.3, fontWeight: 700 }}>{approach}</p>}
        </div>
      )}

      <div style={{ marginTop: '0.5em', background: INK, color: CREAM, borderRadius: '0.5em', padding: '0.5em 0.65em', display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
        <span style={{ ...eyebrow, color: YELLOW }}>
          {variant === 'found'
            ? phoneText
              ? `Is this your ${word}? Call or text`
              : `Is this your ${word}? Open the report`
            : phoneText
              ? `Seen ${who}? Call or text, any hour`
              : `Seen ${who}? Report it`}
        </span>
        {phoneText ? (
          <span style={{ fontSize: '1.5em', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{phoneText}</span>
        ) : (
          <span style={{ fontSize: '0.9em', fontWeight: 800, lineHeight: 1.1 }}>{link || 'reunitepets.org'}</span>
        )}
        {email && <span style={{ fontSize: '0.56em', opacity: 0.95 }}>{phoneText ? 'or email ' : 'email '}{email}</span>}
        {phoneText && link && <span style={{ fontSize: '0.56em', opacity: 0.95 }}>{link}</span>}
      </div>
    </div>
  );
}
