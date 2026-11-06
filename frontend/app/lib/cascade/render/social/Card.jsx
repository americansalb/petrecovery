import React from 'react';
import { fitUnbounded, fitInter, interEm, eyebrowW, STICKER } from '../flyers/plan';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers, second
 * design" (the three Share boards): the sticker on yellow at the three
 * sizes phones pass around. The photo as a round sticker with a cream
 * ring and a navy shadow; LOST in Unbounded; the name; where and when;
 * what to look for; then the contact panel on navy: the phone with the
 * email under it, the QR code and the short link (the link preview, which
 * is itself the link, keeps the plain phone pill). og 1200×630 (sticker
 * left, words right), square 1080×1080 and story 1080×1920 (sticker above,
 * everything centred). SOCIAL_FRAMES in ../flyers/plan.js holds each
 * sticker's size.
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const YEL = '#facc15';
const NAVY = '#0f172a';
const CREAM = '#fffbea';
const SOFT = '#3b3a2e';
const LOST = '#dc2626';
const MAP_GROUND = '#eef2f8';

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;
// satori truncates (lineClamp) only inside a block container with a width.
const Clamp = ({ lines, style, children }) => <div style={{ display: 'block', lineClamp: lines, ...style }}>{children}</div>;

const disp = (size, color = NAVY) => ({ fontFamily: 'Unbounded', fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color, whiteSpace: 'nowrap' });
const name = (size, color = NAVY) => ({ fontFamily: 'Inter', fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: -size * 0.02, color, whiteSpace: 'nowrap' });
const eyebrow = (size, color = NAVY) => ({ fontFamily: 'Inter', fontWeight: 700, fontSize: size, letterSpacing: size * 0.14, textTransform: 'uppercase', color });
const body = (size, color = NAVY, weight = 500) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.4, color });

const rewardLine = (data) => (data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`);

function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (data.email) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

const LINK_EYEBROW = 'Report a sighting';

function lookForLine(data) {
  const facts = data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : '';
  return `${data.lookFor || ''}${facts}`.trim() || data.description || '';
}

/* ------------------------------------------------------------- primitives */

function Sticker({ data, src, size }) {
  const ring = Math.round(size * STICKER.ring);
  const off = Math.round(size * STICKER.shadow);
  const inner = size - ring * 2;
  return (
    <div style={{ display: 'flex', position: 'relative', width: size + off, height: size + off, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: off, top: off, width: size, height: size, borderRadius: size / 2, backgroundColor: NAVY }} />
      <Col style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <img src={src} width={inner} height={inner} style={{ width: inner, height: inner, borderRadius: inner / 2, objectFit: 'cover' }} />
        ) : (
          <Col style={{ width: inner, height: inner, borderRadius: inner / 2, padding: inner * 0.16, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ ...eyebrow(Math.round(size * 0.026), SOFT), textAlign: 'center', justifyContent: 'center', marginBottom: 12 }}>No photo yet. Please go by this.</Txt>
            <Txt style={{ ...name(Math.round(size * 0.055)), whiteSpace: 'normal', textAlign: 'center', justifyContent: 'center', lineHeight: 1.2 }}>{data.description || data.lookFor}</Txt>
          </Col>
        )}
      </Col>
      {data.reward ? (
        <Row style={{ position: 'absolute', right: -4, top: Math.round(size * 0.08), backgroundColor: CREAM, border: `3px solid ${NAVY}`, borderRadius: 999, padding: '10px 18px', ...eyebrow(Math.round(size * 0.034)) }}>{rewardLine(data)}</Row>
      ) : null}
      {data.needsMedication ? (
        <Row style={{ position: 'absolute', left: -4, top: Math.round(size * 0.08), backgroundColor: LOST, border: `3px solid ${CREAM}`, borderRadius: 999, padding: '10px 18px', ...eyebrow(Math.round(size * 0.034), CREAM) }}>Needs medication</Row>
      ) : null}
    </div>
  );
}

function Pill({ data, w, phoneMax, eye, align = 'center' }) {
  const padX = Math.round(phoneMax * 0.9);
  const phone = fitUnbounded(data.contactValue, w - padX * 2, phoneMax, phoneMax * 0.3);
  return (
    <Col style={{ width: w, backgroundColor: NAVY, borderRadius: 999, padding: `${Math.round(phoneMax * 0.42)}px ${padX}px`, alignItems: align }}>
      <Txt style={eyebrow(eye, YEL)}>{contactEyebrow(data)}</Txt>
      <Txt style={{ ...disp(phone, CREAM), marginTop: Math.round(eye * 0.5) }}>{data.contactValue}</Txt>
    </Col>
  );
}

function QrTile({ data, size }) {
  if (!data.qrDataUrl) return null;
  const pad = Math.round(size * 0.09);
  return (
    <Col style={{ width: size, height: size, backgroundColor: CREAM, borderRadius: Math.round(size * 0.16), padding: pad, flexShrink: 0 }}>
      <img src={data.qrDataUrl} width={size - pad * 2} height={size - pad * 2} style={{ width: size - pad * 2, height: size - pad * 2 }} />
    </Col>
  );
}

/**
 * The contact panel (see Flyer.jsx ContactPanel): the phone with the email
 * under it, the QR code, the short link under "Report a sighting", all in
 * one navy block. `k` is pixels per Letter point, so the square and the
 * story keep the sheet's proportions.
 */
function ContactPanel({ data, w, k }) {
  const padX = Math.round(18 * k);
  const qr = data.qrDataUrl ? Math.round(60 * k) : 0;
  const mainIsLink = !data.hasPhone && !data.email;
  const link = mainIsLink ? '' : data.caseUrlLabel;
  const linkSize = Math.round(10 * k);
  const linkW = link ? Math.ceil(Math.max(interEm(link) * linkSize, eyebrowW(LINK_EYEBROW, 7.5 * k))) : 0;
  const leftW = w - padX * 2 - (qr ? qr + Math.round(12 * k) : 0) - (linkW ? linkW + Math.round(9 * k) : 0);
  const phone = fitUnbounded(data.contactValue, leftW, 34.5 * k, 10 * k);
  const emailLine = data.hasPhone && data.email ? `or email ${data.email}` : '';
  const emailSize = emailLine ? fitInter(emailLine, leftW, 9.75 * k, 7 * k) : 0;
  return (
    <Row style={{ width: w, height: Math.round(90 * k), backgroundColor: NAVY, borderRadius: Math.round(20 * k), padding: `0 ${padX}px`, alignItems: 'center' }}>
      <Col style={{ width: leftW }}>
        <Txt style={{ ...eyebrow(9 * k, YEL), whiteSpace: 'nowrap' }}>{contactEyebrow(data)}</Txt>
        <Txt style={{ ...disp(phone, CREAM), marginTop: Math.round(6 * k) }}>{data.contactValue}</Txt>
        {emailLine ? <Txt style={{ ...body(emailSize, CREAM, 500), marginTop: Math.round(6 * k), lineHeight: 1.2, whiteSpace: 'nowrap' }}>{emailLine}</Txt> : null}
      </Col>
      {qr ? (
        <Col style={{ marginLeft: Math.round(12 * k) }}>
          <QrTile data={data} size={qr} />
        </Col>
      ) : null}
      {link ? (
        <Col style={{ marginLeft: Math.round(qr ? 9 * k : 12 * k), width: linkW }}>
          <Txt style={eyebrow(7.5 * k, YEL)}>{LINK_EYEBROW}</Txt>
          <Txt style={{ ...body(linkSize, CREAM, 700), marginTop: Math.round(3 * k), lineHeight: 1.2, whiteSpace: 'nowrap' }}>{link}</Txt>
        </Col>
      ) : null}
    </Row>
  );
}

/**
 * The last-seen map (see Flyer.jsx MapTile). The cascade's tiles are in
 * points, drawn here at 1.5× so street names stay readable on a screen.
 */
export function MapTile({ data, w, h, radius = 14 }) {
  const m = data.map;
  if (!m) {
    return (
      <Col style={{ width: w, height: h, borderRadius: radius, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Txt style={eyebrow(11, SOFT)}>Map at the link</Txt>
      </Col>
    );
  }
  const sc = 1.5;
  const cx = w / 2;
  const cy = h / 2;
  const ox = cx - m.pin.x * sc;
  const oy = cy - m.pin.y * sc;
  const halo = Math.min((m.halo?.r || 20) * sc, Math.min(w, h) * 0.3);
  const ring = m.ring && m.ring.r * sc <= Math.min(w, h) * 0.46 ? { r: m.ring.r * sc, label: m.ring.label } : null;
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: MAP_GROUND, border: `3px solid ${NAVY}`, flexShrink: 0 }}>
      {m.tiles.map((t, i) => (
        <img key={i} src={t.src} width={128 * sc} height={128 * sc} style={{ position: 'absolute', left: ox + t.left * sc, top: oy + t.top * sc, width: 128 * sc, height: 128 * sc }} />
      ))}
      {ring ? <div style={{ position: 'absolute', left: cx - ring.r, top: cy - ring.r, width: ring.r * 2, height: ring.r * 2, borderRadius: ring.r, border: `2px dashed ${NAVY}` }} /> : null}
      <div style={{ position: 'absolute', left: cx - halo, top: cy - halo, width: halo * 2, height: halo * 2, borderRadius: halo, backgroundColor: 'rgba(220, 38, 38, 0.2)', border: `3px solid ${LOST}` }} />
      <div style={{ position: 'absolute', left: cx - 10, top: cy - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: LOST, border: `3px solid ${CREAM}` }} />
      <Txt style={{ position: 'absolute', left: 10, top: 10, backgroundColor: NAVY, borderRadius: 999, padding: '4px 10px', ...eyebrow(10, CREAM) }}>Last seen here</Txt>
      {ring ? <Txt style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: CREAM, borderRadius: 999, padding: '3px 8px', ...eyebrow(9, NAVY) }}>{`${ring.label} ring`}</Txt> : null}
      <Txt style={{ position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', padding: '1px 4px', fontFamily: 'Inter', fontSize: 8, color: SOFT }}>{m.attribution}</Txt>
    </div>
  );
}

/** Where and when, what to look for, then "If you see Max": what to do, beside the map. */
function Where({ data, size, width, lines = 2 }) {
  return (
    <Col style={{ width, justifyContent: 'center' }}>
      <Txt style={eyebrow(size * 0.72)}>Last seen</Txt>
      {data.lastSeenWhen ? <Txt style={{ ...body(size * 1.15, NAVY, 700), marginTop: 2, lineHeight: 1.2 }}>{data.lastSeenWhen}</Txt> : null}
      <Clamp lines={1} style={{ ...body(size * 0.92, SOFT, 500), width, lineHeight: 1.3 }}>{data.lastSeenArea}</Clamp>
      <Clamp lines={lines} style={{ ...body(size * 0.95), width, marginTop: size * 0.4, lineHeight: 1.35 }}>{lookForLine(data)}</Clamp>
      <Txt style={{ ...eyebrow(size * 0.72), marginTop: size * 0.6 }}>{`If you see ${data.petName}`}</Txt>
      {data.health ? <Clamp lines={2} style={{ ...body(size * 0.95, LOST, 700), width, lineHeight: 1.25, marginTop: 2 }}>{data.health}</Clamp> : null}
      <Clamp lines={data.health ? 2 : 3} style={{ ...body(size * 0.95, NAVY, 600), width, lineHeight: 1.3, marginTop: 2 }}>{data.ifYouSee}</Clamp>
    </Col>
  );
}

function LastSeen({ data, size, width, align = 'center' }) {
  return (
    <Row style={{ width, alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : 'flex-start', ...body(size, SOFT, 400), whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <Txt style={{ ...eyebrow(size * 0.7), marginRight: size * 0.6, flexShrink: 0 }}>Last seen</Txt>
      {data.lastSeenWhen ? <Txt style={{ fontWeight: 700, color: NAVY, marginRight: size * 0.6, flexShrink: 0 }}>{data.lastSeenWhen}</Txt> : null}
      <Txt style={{ lineClamp: 1 }}>{data.lastSeenArea}</Txt>
    </Row>
  );
}

function Facts({ data, size, width, lines = 2, align = 'center' }) {
  return <Txt style={{ ...body(size), width, lineClamp: lines, textAlign: align, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>{lookForLine(data)}</Txt>;
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src }) {
  const W = 510;
  return (
    <Col style={{ width: 1200, height: 630, backgroundColor: YEL, fontFamily: 'Inter', color: NAVY, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 56, top: 58, display: 'flex' }}>
        <Sticker data={data} src={src} size={500} />
      </div>
      <Col style={{ position: 'absolute', left: 640, top: 60, width: W }}>
        <Txt style={disp(fitUnbounded(data.stamp, W, 120, 60))}>{data.stamp}</Txt>
        <Clamp lines={1} style={{ ...name(34), marginTop: 10, width: W }}>{data.coverLine}</Clamp>
        <Row style={{ marginTop: 12, height: 200 }}>
          <MapTile data={data} w={210} h={200} />
          <Col style={{ marginLeft: 14, width: W - 224 }}>
            <Where data={data} size={15} width={W - 224} />
          </Col>
        </Row>
      </Col>
      <Col style={{ position: 'absolute', left: 640, bottom: 56, width: W }}>
        <Pill data={data} w={W} phoneMax={42} eye={12} />
      </Col>
    </Col>
  );
}

function Square({ data, src }) {
  const W = 1000;
  return (
    <Col style={{ width: 1080, height: 1080, backgroundColor: YEL, fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: '48px 40px 40px' }}>
      <Sticker data={data} src={src} size={420} />
      <Txt style={{ ...disp(fitUnbounded(data.stamp, W, 104, 60)), marginTop: 20 }}>{data.stamp}</Txt>
      <Txt style={{ ...name(34), marginTop: 8 }}>{data.coverLine}</Txt>
      <Row style={{ marginTop: 14, width: W, height: 215 }}>
        <MapTile data={data} w={400} h={215} />
        <Col style={{ marginLeft: 16, width: W - 416 }}>
          <Where data={data} size={17} width={W - 416} />
        </Col>
      </Row>
      <Col style={{ flexGrow: 1 }} />
      <ContactPanel data={data} w={W} k={1.6} />
    </Col>
  );
}

function Story({ data, src }) {
  const W = 968;
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: YEL, fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: '150px 56px 140px' }}>
      <Sticker data={data} src={src} size={760} />
      <Txt style={{ ...disp(fitUnbounded(data.stamp, W, 180, 80)), marginTop: 36 }}>{data.stamp}</Txt>
      <Txt style={{ ...name(48), marginTop: 14 }}>{data.coverLine}</Txt>
      <Row style={{ marginTop: 24, width: W, height: 330 }}>
        <MapTile data={data} w={440} h={330} radius={20} />
        <Col style={{ marginLeft: 24, width: W - 464 }}>
          <Where data={data} size={24} width={W - 464} />
        </Col>
      </Row>
      <Col style={{ flexGrow: 1 }} />
      <ContactPanel data={data} w={W} k={W / 516} />
    </Col>
  );
}

/**
 * @param {{data:object, size:'og'|'square'|'story', photoSrc:string|null}} props
 */
export function SocialCard({ data, size = 'og', photoSrc }) {
  const src = photoSrc ?? data.photos?.[0]?.src ?? null;
  if (size === 'square') return <Square data={data} src={src} />;
  if (size === 'story') return <Story data={data} src={src} />;
  return <Og data={data} src={src} />;
}

export default SocialCard;
