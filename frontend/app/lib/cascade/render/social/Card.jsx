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
  const nameSize = isStory ? 116 : isSquare ? 84 : 72;
  const stampSize = isStory ? 40 : 30;
  const chipSize = isStory ? 32 : isSquare ? 26 : 24;
  const qrSize = isStory ? 200 : isSquare ? 150 : 132;

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
      <div style={{ display: 'flex', color: '#ffffff', fontSize: nameSize, fontWeight: 900, letterSpacing: 4 }}>
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
        justifyContent: 'center',
        padding: pad,
        backgroundColor: '#ffffff',
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
      <div style={{ display: 'flex', color: MIDNIGHT, fontSize: nameSize, fontWeight: 900, marginTop: 20, letterSpacing: -1 }}>
        {data.petName}
      </div>
      {data.chips ? (
        <div style={{ display: 'flex', color: '#475569', fontSize: chipSize, fontWeight: 600, marginTop: 8 }}>
          {data.chips}
        </div>
      ) : null}
      <div style={{ display: 'flex', color: '#64748b', fontSize: chipSize, marginTop: isStory ? 24 : 14 }}>
        Last seen {data.lastSeenArea}
      </div>
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
