import React from 'react';

/**
 * Social share cards in the owner's poster design system (Lost Pet
 * Posters.dc.html, artboard 1c): Archivo/Archivo Black, yellow strip,
 * yellow LOST {SPECIES} display on a navy header band, framed photo,
 * HAVE YOU SEEN {NAME}?, reward block, info rows, last-seen map with the
 * navy halo, QR box, and a navy phone footer. One design, laid out for
 * three sizes (og 1200x630, square 1080x1080, story 1080x1920).
 *
 * satori only understands inline styles and needs display:flex on every
 * element with >1 child - hence the verbosity.
 */

const INK = '#0A0D26';
const NAVY = '#0B1133';
const CREAM = '#FFF9EE';
const YELLOW = '#F2D21B';
const CELL = '#F3EFE7';
const MUTE = '#8A8377';

function Row(props) {
  return <div style={{ display: 'flex', flexDirection: 'row', ...props.style }}>{props.children}</div>;
}
function Col(props) {
  return <div style={{ display: 'flex', flexDirection: 'column', ...props.style }}>{props.children}</div>;
}

function Label({ size, children, color = MUTE }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: 'Archivo',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: size * 0.14,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  );
}

/** Yellow-on-navy header band: strip, urgent row, LOST {SPECIES}. */
function Header({ data, k, headSize, showSeenLine }) {
  return (
    <Col style={{ width: '100%' }}>
      <div style={{ display: 'flex', height: 12 * k, backgroundColor: YELLOW, width: '100%' }} />
      <Col style={{ backgroundColor: NAVY, padding: `${26 * k}px ${44 * k}px ${24 * k}px` }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 * k }}>
          <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 15 * k, fontWeight: 800, letterSpacing: 3 * k, color: CREAM }}>
            URGENT · PLEASE HELP
          </div>
          <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 15 * k, fontWeight: 800, color: 'rgba(255,249,238,0.6)' }}>
            reunitepets.org
          </div>
        </Row>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Archivo Black',
            fontSize: headSize,
            lineHeight: 0.95,
            letterSpacing: -headSize * 0.01,
            color: YELLOW,
          }}
        >
          {data.stamp} {data.speciesLabel}
        </div>
        {showSeenLine ? (
          <div
            style={{
              display: 'flex',
              fontFamily: 'Archivo',
              fontSize: 22 * k,
              fontWeight: 800,
              letterSpacing: 2 * k,
              marginTop: 10 * k,
              color: CREAM,
            }}
          >
            HAVE YOU SEEN {data.petName.toUpperCase()}?
          </div>
        ) : null}
      </Col>
    </Col>
  );
}

/** Bordered photo (design slot: cover crop, gentle face bias). */
function Photo({ data, style, k }) {
  return (
    <div style={{ display: 'flex', border: `${4 * k}px solid ${INK}`, backgroundColor: CELL, overflow: 'hidden', ...style }}>
      {data.photoDataUrl ? (
        // Contain, never crop: the whole pet always shows, matted on the warm
        // cell ground inside the ink frame.
        <img
          src={data.photoDataUrl}
          width="100%"
          height="100%"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 * k }}>
          <div style={{ display: 'flex', fontFamily: 'Archivo', fontWeight: 700, fontSize: 20 * k, color: MUTE, textAlign: 'center' }}>
            No photo yet. Please go by the description.
          </div>
        </Col>
      )}
    </div>
  );
}

/** Last-seen map crop with navy halo + dot (the design's Leaflet look). */
function MapPanel({ data, w, h, k }) {
  const m = data.map;
  if (!m) return null;
  // Tile spec is in pt (128pt tiles); scale into this panel's px space.
  const s = 2 * k; // 1pt -> 2px at k=1 keeps ~z15 street legibility
  const ox = (w - m.width * s) / 2;
  const oy = (h - m.height * s) / 2;
  const px = ox + m.pin.x * s;
  const py = oy + m.pin.y * s;
  const haloR = Math.min((m.halo?.r || 25) * s, Math.min(w, h) * 0.42);
  return (
    <div style={{ display: 'flex', width: w, height: h, border: `${4 * k}px solid ${INK}`, overflow: 'hidden', position: 'relative', backgroundColor: '#E8E4DB' }}>
      {m.tiles.map((t, i) => (
        <img
          key={i}
          src={t.src}
          width={128 * s}
          height={128 * s}
          style={{ position: 'absolute', left: ox + t.left * s, top: oy + t.top * s, width: 128 * s, height: 128 * s }}
        />
      ))}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: px - haloR,
          top: py - haloR,
          width: haloR * 2,
          height: haloR * 2,
          borderRadius: haloR,
          backgroundColor: 'rgba(11,17,51,0.22)',
          border: `${3 * k}px solid ${NAVY}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: px - 8 * k,
          top: py - 8 * k,
          width: 16 * k,
          height: 16 * k,
          borderRadius: 8 * k,
          backgroundColor: NAVY,
          border: `${3 * k}px solid #ffffff`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: `${2 * k}px ${6 * k}px`,
          fontFamily: 'Archivo',
          fontSize: 9 * k,
          color: '#6B6459',
        }}
      >
        {m.attribution}
      </div>
    </div>
  );
}

function QrPanel({ data, k, qrSize, caption }) {
  if (!data.qrDataUrl) return null;
  return (
    <Row style={{ border: `${4 * k}px solid ${INK}`, padding: `${10 * k}px ${12 * k}px`, alignItems: 'center', backgroundColor: '#ffffff' }}>
      <img src={data.qrDataUrl} width={qrSize} height={qrSize} style={{ width: qrSize, height: qrSize }} />
      <div
        style={{
          display: 'flex',
          marginLeft: 12 * k,
          fontFamily: 'Archivo',
          fontSize: 11 * k,
          fontWeight: 700,
          letterSpacing: 1 * k,
          textTransform: 'uppercase',
          color: MUTE,
          lineHeight: 1.4,
          maxWidth: 160 * k,
        }}
      >
        {caption}
      </div>
    </Row>
  );
}

/** Navy footer: CALL OR TEXT + phone + listing URL. */
function Footer({ data, k, h }) {
  const value = data.contactValue || data.caseUrlLabel;
  const isEmail = /@/.test(value);
  return (
    <Row
      style={{
        backgroundColor: NAVY,
        height: h,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${44 * k}px`,
        width: '100%',
      }}
    >
      <Row style={{ alignItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 13 * k, fontWeight: 800, letterSpacing: 2.5 * k, color: 'rgba(255,249,238,0.8)' }}>
          {/EMAIL/i.test(data.contactVerb || '') ? 'EMAIL' : /\sAT$/.test(data.contactVerb || '') ? 'REPORT AT' : 'CALL OR TEXT'}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Archivo Black',
            fontSize: (isEmail ? 30 : 42) * k,
            color: CREAM,
            marginLeft: 16 * k,
          }}
        >
          {value}
        </div>
      </Row>
      <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 16 * k, fontWeight: 700, color: 'rgba(255,249,238,0.85)' }}>
        {data.caseUrlLabel}
      </div>
    </Row>
  );
}

function InfoBlock({ data, k, label, value }) {
  return (
    <Col>
      <Label size={12 * k}>{label}</Label>
      <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 17 * k, fontWeight: 600, lineHeight: 1.35, color: INK, marginTop: 2 * k }}>
        {value}
      </div>
    </Col>
  );
}

function colorMarkings(data) {
  const chips = String(data.chips || '').split('  •  ');
  const bits = [chips[1] || null, data.markings || null].filter(Boolean);
  return bits.join(' · ') || data.chips || '-';
}

/** Right rail shared by square + og: name, reward, color, last seen + map + QR. */
function Rail({ data, k, w, mapH, showName }) {
  return (
    <Col style={{ width: w, flexShrink: 0, justifyContent: 'flex-start' }}>
      {showName ? (
        <Col style={{ marginBottom: 14 * k }}>
          <Label size={12 * k} color={NAVY}>
            Have you seen
          </Label>
          <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 52 * k, lineHeight: 1, color: INK }}>
            {data.petName.toUpperCase()}
          </div>
        </Col>
      ) : null}
      {data.reward ? (
        <Col style={{ backgroundColor: YELLOW, padding: `${12 * k}px ${18 * k}px`, marginBottom: 14 * k }}>
          <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 12 * k, fontWeight: 800, letterSpacing: 2.4 * k, color: INK, opacity: 0.85 }}>
            REWARD
          </div>
          <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 38 * k, lineHeight: 1, color: INK }}>
            {data.reward === 'REWARD' ? 'OFFERED' : data.reward}
          </div>
        </Col>
      ) : null}
      <InfoBlock data={data} k={k} label="Color & markings" value={colorMarkings(data)} />
      <Col style={{ marginTop: 'auto' }}>
        <Label size={12 * k}>Last seen</Label>
        <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 19 * k, fontWeight: 700, lineHeight: 1.25, color: INK, marginTop: 1 * k }}>
          {data.lastSeenArea}
        </div>
        <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 14 * k, fontWeight: 600, color: MUTE, marginBottom: 8 * k }}>
          {data.lastSeenWhen}
        </div>
        {data.map ? <MapPanel data={data} w={w} h={mapH} k={k} /> : null}
        <Col style={{ marginTop: 12 * k }}>
          <QrPanel data={data} k={k} qrSize={96 * k} caption={data.scanCta} />
        </Col>
      </Col>
    </Col>
  );
}

export function SocialCard({ data, size }) {
  if (size === 'story') {
    // 1080x1920: header, tall photo, rail content, footer.
    const k = 1;
    return (
      <Col style={{ width: '100%', height: '100%', backgroundColor: '#ffffff', fontFamily: 'Archivo' }}>
        <Header data={data} k={k} headSize={110} showSeenLine />
        <Row style={{ flexGrow: 1, padding: `${30 * k}px ${44 * k}px`, minHeight: 0 }}>
          <Photo data={data} k={k} style={{ flexGrow: 1, minWidth: 0 }} />
        </Row>
        <Row style={{ padding: `0 ${44 * k}px ${28 * k}px`, justifyContent: 'space-between' }}>
          <Col style={{ width: 560, justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 64, lineHeight: 1, color: INK }}>
              {data.petName.toUpperCase()}
            </div>
            <Col style={{ marginTop: 16 }}>
              <InfoBlock data={data} k={1.2} label="Color & markings" value={colorMarkings(data)} />
            </Col>
            {data.reward ? (
              <Row style={{ backgroundColor: YELLOW, padding: '12px 18px', marginTop: 18, alignItems: 'baseline', alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 14, fontWeight: 800, letterSpacing: 3, color: INK, opacity: 0.85 }}>
                  REWARD
                </div>
                <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 40, lineHeight: 1, color: INK, marginLeft: 12 }}>
                  {data.reward === 'REWARD' ? 'OFFERED' : data.reward}
                </div>
              </Row>
            ) : null}
          </Col>
          <Col style={{ width: 400, justifyContent: 'flex-start' }}>
            <Label size={13}>Last seen</Label>
            <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: INK }}>
              {data.lastSeenArea}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 15, fontWeight: 600, color: MUTE, marginBottom: 8 }}>
              {data.lastSeenWhen}
            </div>
            {data.map ? <MapPanel data={data} w={400} h={230} k={1} /> : null}
            <Col style={{ marginTop: 12 }}>
              <QrPanel data={data} k={1} qrSize={92} caption={data.scanCta} />
            </Col>
          </Col>
        </Row>
        <Footer data={data} k={1} h={124} />
      </Col>
    );
  }

  if (size === 'square') {
    // 1080x1080 - the design's 1c artboard.
    const k = 1;
    return (
      <Col style={{ width: '100%', height: '100%', backgroundColor: '#ffffff', fontFamily: 'Archivo' }}>
        <Header data={data} k={k} headSize={104} showSeenLine />
        <Row style={{ flexGrow: 1, padding: `${30 * k}px ${44 * k}px`, minHeight: 0 }}>
          <Photo data={data} k={k} style={{ width: 0, flexGrow: 1, marginRight: 30 * k }} />
          <Rail data={data} k={k} w={320} mapH={150} showName />
        </Row>
        <Footer data={data} k={k} h={124} />
      </Col>
    );
  }

  // og 1200x630: photo left, condensed header + rail right.
  const k = 0.78;
  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: '#ffffff', fontFamily: 'Archivo' }}>
      <Row style={{ flexGrow: 1, minHeight: 0 }}>
        <Photo data={data} k={k} style={{ width: '44%', height: '100%', borderWidth: 0, borderRight: `${4 * k}px solid ${INK}` }} />
        <Col style={{ width: 0, flexGrow: 1 }}>
          <Header data={data} k={k} headSize={64} showSeenLine={false} />
          <Row style={{ flexGrow: 1, padding: `${18 * k}px ${34 * k}px`, minHeight: 0 }}>
            <Col style={{ width: 0, flexGrow: 1, marginRight: 20 * k, justifyContent: 'flex-start' }}>
              <Label size={12 * k} color={NAVY}>
                Have you seen
              </Label>
              <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 46 * k, lineHeight: 1, color: INK }}>
                {data.petName.toUpperCase()}
              </div>
              <Col style={{ marginTop: 12 * k }}>
                <InfoBlock data={data} k={k} label="Color & markings" value={colorMarkings(data)} />
              </Col>
              <Col style={{ marginTop: 12 * k }}>
                <Label size={12 * k}>Last seen</Label>
                <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 17 * k, fontWeight: 700, lineHeight: 1.3, color: INK }}>
                  {data.lastSeenArea}
                </div>
                <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 13 * k, fontWeight: 600, color: MUTE }}>
                  {data.lastSeenWhen}
                </div>
              </Col>
              {data.reward ? (
                <Row style={{ backgroundColor: YELLOW, padding: `${8 * k}px ${14 * k}px`, marginTop: 'auto', alignItems: 'baseline', alignSelf: 'flex-start' }}>
                  <div style={{ display: 'flex', fontFamily: 'Archivo', fontSize: 11 * k, fontWeight: 800, letterSpacing: 2 * k, color: INK, opacity: 0.85 }}>
                    REWARD
                  </div>
                  <div style={{ display: 'flex', fontFamily: 'Archivo Black', fontSize: 30 * k, lineHeight: 1, color: INK, marginLeft: 10 * k }}>
                    {data.reward === 'REWARD' ? 'OFFERED' : data.reward}
                  </div>
                </Row>
              ) : null}
            </Col>
            <Col style={{ width: 250 * k, flexShrink: 0, justifyContent: 'flex-end' }}>
              {data.map ? <MapPanel data={data} w={250 * k} h={160 * k} k={k} /> : null}
              <Col style={{ marginTop: 10 * k }}>
                <QrPanel data={data} k={k} qrSize={80 * k} caption={data.scanCta} />
              </Col>
            </Col>
          </Row>
          <Footer data={data} k={k} h={86 * k} />
        </Col>
      </Row>
    </Col>
  );
}
