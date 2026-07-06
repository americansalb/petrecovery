import React from 'react';

/**
 * One social-card design, laid out responsively for three sizes. satori only
 * understands inline styles, and every element with >1 child must declare
 * display:flex — so this is deliberately verbose. Returns a React element tree
 * satori can walk.
 */

const MIDNIGHT = '#0f172a';
const FLASH = '#facc15';

export function SocialCard({ data, size }) {
  const isStory = size === 'story';
  const isSquare = size === 'square';
  const isWide = size === 'og';

  // photo occupies the top (portrait/square) or left (wide)
  const photoPane = isWide
    ? { width: '46%', height: '100%' }
    : { width: '100%', height: isStory ? '52%' : '58%' };

  const pad = isStory ? 72 : isSquare ? 56 : 48;
  const headSize = isStory ? 76 : isSquare ? 58 : 50;
  const stampSize = isStory ? 34 : 26;
  const pleaSize = isStory ? 34 : isSquare ? 27 : 24;
  const chipSize = isStory ? 30 : isSquare ? 25 : 22;
  const qrSize = isStory ? 190 : isSquare ? 148 : 128;

  const PhotoBlock = data.photoDataUrl ? (
    <img src={data.photoDataUrl} style={{ ...photoPane, objectFit: 'cover' }} />
  ) : (
    <div
      style={{
        ...photoPane,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: MIDNIGHT,
      }}
    >
      <div style={{ display: 'flex', color: '#ffffff', fontSize: isStory ? 130 : 96, fontWeight: 900, letterSpacing: 4 }}>
        {data.speciesLabel}
      </div>
    </div>
  );

  const InfoPane = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0, // let this flex item shrink below content width so text wraps
        justifyContent: isWide ? 'flex-start' : 'center',
        padding: pad,
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            backgroundColor: data.accentBg,
            color: '#ffffff',
            fontSize: stampSize,
            fontWeight: 900,
            letterSpacing: 2,
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 20,
            paddingRight: 20,
            borderRadius: 8,
          }}
        >
          {data.stamp} {data.speciesLabel}
        </div>
      </div>
      <div style={{ display: 'flex', color: MIDNIGHT, fontSize: headSize, fontWeight: 900, marginTop: 18, letterSpacing: -1, lineHeight: 1.05 }}>
        {data.headline}
      </div>
      {data.plea ? (
        <div style={{ display: 'flex', color: '#334155', fontSize: pleaSize, fontWeight: 500, marginTop: 14, lineHeight: 1.35 }}>
          {isStory ? data.plea : data.pleaShort}
        </div>
      ) : null}
      {data.chips ? (
        <div style={{ display: 'flex', color: '#64748b', fontSize: chipSize, fontWeight: 600, marginTop: isStory ? 18 : 10 }}>
          {data.chips} · Last seen {data.lastSeenArea}
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: 24 }}>
        {data.qrDataUrl ? (
          <img src={data.qrDataUrl} style={{ width: qrSize, height: qrSize, borderRadius: 10, border: '4px solid #0f172a' }} />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: data.qrDataUrl ? 24 : 0 }}>
          <div style={{ display: 'flex', color: MIDNIGHT, fontSize: chipSize + 6, fontWeight: 800 }}>
            Reunite<span style={{ color: FLASH }}>Pets</span>.org
          </div>
          <div style={{ display: 'flex', color: '#94a3b8', fontSize: chipSize - 4, marginTop: 4 }}>
            Scan to help find {data.petName}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
      }}
    >
      {PhotoBlock}
      {InfoPane}
    </div>
  );
}
