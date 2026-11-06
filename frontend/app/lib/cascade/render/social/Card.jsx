import React from 'react';
import { fitUnbounded, fitInter, interEm, eyebrowW, PRINT, BAND, bandBox, printInner, SOCIAL_FRAMES } from '../flyers/plan';
import { grainDataUrl, GRAIN_TILE } from '../textures';
import { GROUND, LIGHT } from '../ground';

/**
 * Share images, the Claude Design canvas "Lost Pet Flyers, the sticker"
 * at the three sizes phones pass around, on the same ground as the paper
 * (../ground.js): the brand's yellow lit from behind the photo and
 * deepening to amber at the corners, sun rays from the same point,
 * caution stripes along the top and the foot, grain over it all. The
 * pet's photo as a print in a cream mat with a hard navy shadow; LOST in
 * Unbounded, cream on a red band set a touch askew; the name; where and
 * when beside the map; "If you see Max" on a cream note card, the full
 * width, never cut; then the contact panel on navy (the link preview,
 * which is itself the link, keeps the plain phone pill). og 1200×630
 * (print left, words right), square 1080×1080 and story 1080×1920 (print
 * above). SOCIAL_FRAMES in ../flyers/plan.js holds each print's size and
 * place; the rays and stripes come in as one PNG (`groundSrc`, drawn by
 * ../ground.js in index.js), since satori draws no polygons.
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const YEL = GROUND.yellow;
const NAVY = GROUND.ink;
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

/** The lit yellow, brightest behind the print of `frame`, on an image `w` by `h`. */
function lit(frame, w, h) {
  const cx = (((frame.x + frame.w / 2) / w) * 100).toFixed(1);
  const cy = (((frame.y + frame.h / 2) / h) * 100).toFixed(1);
  return `radial-gradient(circle at ${cx}% ${cy}%, ${LIGHT.map(([o, c]) => `${c} ${Math.round(o * 100)}%`).join(', ')})`;
}
/** The rays and the caution stripes, one PNG over the lit yellow (../ground.js). */
const Ground = ({ src, w, h }) => (src ? <img src={src} width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} /> : null);
const Grain = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundImage: `url(${grainDataUrl()})`, backgroundRepeat: 'repeat', backgroundSize: `${GRAIN_TILE * 2}px ${GRAIN_TILE * 2}px`, opacity: 0.06 }} />
);

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

/**
 * The word in cream on a band of the stamp's colour (red for LOST), a
 * touch askew, with the print's hard navy shadow behind it (see
 * Flyer.jsx, Band). The caps start 0.245 em into Unbounded's line box.
 */
function Band({ size, color, children }) {
  const { w, h, off } = bandBox(size, children);
  const padX = BAND.padX * size;
  const pad = BAND.pad * size;
  const r = size * 0.1;
  const turn = 'rotate(-1.2deg)';
  return (
    <div style={{ display: 'flex', position: 'relative', width: w + off, height: h + off, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: off, top: off, width: w, height: h, borderRadius: r, backgroundColor: NAVY, transform: turn }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, backgroundColor: color, transform: turn }} />
      <Txt style={{ ...disp(size, CREAM), position: 'absolute', left: padX, top: pad - size * 0.245, width: w - padX * 2, height: size, justifyContent: 'center', transform: turn }}>{children}</Txt>
    </div>
  );
}

/** A tag on the print's corner: the reward in cream, "Needs medication" in red. */
function Tag({ side, red = false, size, children }) {
  return (
    <Row style={{ position: 'absolute', [side]: 16, top: 16, backgroundColor: red ? LOST : CREAM, border: `3px solid ${red ? CREAM : NAVY}`, borderRadius: 999, padding: '8px 16px', ...eyebrow(size, red ? CREAM : NAVY) }}>{children}</Row>
  );
}

/** The photo as a print: a cream mat in a navy edge, a hard navy shadow, the tags on its corners. */
function Print({ data, src, w, h }) {
  const off = Math.round(w * PRINT.shadow);
  const r = Math.round(w * PRINT.radius);
  const { edge, mat, w: pw, h: ph } = printInner(w, h, 1.5); // a 3 px edge
  const tag = Math.max(12, Math.round(w * 0.026));
  return (
    <div style={{ display: 'flex', position: 'relative', width: w + off, height: h + off, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: off, top: off, width: w, height: h, borderRadius: r, backgroundColor: NAVY }} />
      <Col style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, border: `${edge}px solid ${NAVY}`, backgroundColor: CREAM, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <img src={src} width={pw} height={ph} style={{ width: pw, height: ph, borderRadius: Math.max(0, r - edge - mat), objectFit: 'cover' }} />
        ) : (
          <Col style={{ width: w - edge * 2, padding: w * 0.1, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ ...eyebrow(Math.round(w * 0.022), SOFT), textAlign: 'center', justifyContent: 'center', marginBottom: 12 }}>No photo yet. Please go by this.</Txt>
            <Txt style={{ ...name(Math.round(w * 0.05)), whiteSpace: 'normal', textAlign: 'center', justifyContent: 'center', lineHeight: 1.2 }}>{data.description || data.lookFor}</Txt>
          </Col>
        )}
      </Col>
      {data.reward ? <Tag side="right" size={tag}>{rewardLine(data)}</Tag> : null}
      {data.needsMedication ? (
        <Tag side="left" size={tag} red>
          Needs medication
        </Tag>
      ) : null}
    </div>
  );
}

/** The navy pill: the eyebrow in yellow, the phone in cream, centred. The link preview's contact block. */
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
  const qr = data.qrDataUrl ? Math.round(58 * k) : 0;
  const mainIsLink = !data.hasPhone && !data.email;
  const link = mainIsLink ? '' : data.caseUrlLabel;
  const linkSize = Math.round(10 * k);
  const linkW = link ? Math.ceil(Math.max(interEm(link) * linkSize, eyebrowW(LINK_EYEBROW, 7.5 * k))) : 0;
  const leftW = w - padX * 2 - (qr ? qr + Math.round(12 * k) : 0) - (linkW ? linkW + Math.round(9 * k) : 0);
  const phone = fitUnbounded(data.contactValue, leftW, 34.5 * k, 10 * k);
  const emailLine = data.hasPhone && data.email ? `or email ${data.email}` : '';
  const emailSize = emailLine ? fitInter(emailLine, leftW, 9.75 * k, 7 * k) : 0;
  return (
    <Row style={{ width: w, height: Math.round(84 * k), backgroundColor: NAVY, borderRadius: Math.round(20 * k), padding: `0 ${padX}px`, alignItems: 'center' }}>
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
      <Col style={{ width: w, height: h, borderRadius: radius, backgroundColor: CREAM, border: `3px solid ${NAVY}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

/** Where and when, then what to look for, beside the map. */
function Where({ data, size, width, lines = 3 }) {
  return (
    <Col style={{ width, justifyContent: 'center' }}>
      <Txt style={eyebrow(size * 0.72)}>Last seen</Txt>
      {data.lastSeenWhen ? <Txt style={{ ...body(size * 1.15, NAVY, 700), marginTop: 2, lineHeight: 1.2 }}>{data.lastSeenWhen}</Txt> : null}
      <Clamp lines={1} style={{ ...body(size * 0.92, SOFT, 500), width, lineHeight: 1.3 }}>{data.lastSeenArea}</Clamp>
      <Clamp lines={lines} style={{ ...body(size * 0.95), width, marginTop: size * 0.4, lineHeight: 1.35 }}>{lookForLine(data)}</Clamp>
    </Col>
  );
}

/** "IF YOU SEE MAX" on a cream note card with a navy edge: the health line in red when there is one, then what to do, the full width. */
function Advice({ data, size, width, lines = 3, healthLines = 1 }) {
  const padX = Math.round(size * 0.9);
  const inner = width - padX * 2 - 6;
  return (
    <Col style={{ width, backgroundColor: CREAM, borderRadius: Math.round(size * 0.9), border: `3px solid ${NAVY}`, padding: `${Math.round(size * 0.55)}px ${padX}px` }}>
      <Txt style={eyebrow(size * 0.72)}>{`If you see ${data.petName}`}</Txt>
      {data.health ? <Clamp lines={healthLines} style={{ ...body(size, LOST, 700), width: inner, lineHeight: 1.3, marginTop: 3 }}>{data.health}</Clamp> : null}
      <Clamp lines={lines} style={{ ...body(size, NAVY, 600), width: inner, lineHeight: 1.3, marginTop: 3 }}>{data.ifYouSee}</Clamp>
    </Col>
  );
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src, ground }) {
  const W = 510;
  const f = SOCIAL_FRAMES.og;
  return (
    <Col style={{ width: 1200, height: 630, backgroundColor: YEL, backgroundImage: lit(f, 1200, 630), fontFamily: 'Inter', color: NAVY, position: 'relative' }}>
      <Ground src={ground} w={1200} h={630} />
      <Grain />
      <div style={{ position: 'absolute', left: f.x, top: f.y, display: 'flex' }}>
        <Print data={data} src={src} w={f.w} h={f.h} />
      </div>
      <Col style={{ position: 'absolute', left: 640, top: 50, width: W }}>
        <Row>
          <Band size={fitUnbounded(data.stamp, W - 60, 92, 60)} color={data.accentBg || LOST}>{data.stamp}</Band>
        </Row>
        <Clamp lines={1} style={{ ...name(32), marginTop: 8, width: W }}>{data.coverLine}</Clamp>
        <Row style={{ marginTop: 10, height: 122 }}>
          <MapTile data={data} w={200} h={122} />
          <Col style={{ marginLeft: 14, width: W - 214 }}>
            <Where data={data} size={15} width={W - 214} lines={3} />
          </Col>
        </Row>
        <Col style={{ marginTop: 10 }}>
          <Advice data={data} size={15.5} width={W} lines={3} healthLines={2} />
        </Col>
      </Col>
      <Col style={{ position: 'absolute', left: 640, bottom: 48, width: W }}>
        <Pill data={data} w={W} phoneMax={40} eye={12} />
      </Col>
    </Col>
  );
}

function Square({ data, src, ground }) {
  const W = 1000;
  const f = SOCIAL_FRAMES.square;
  return (
    <Col style={{ width: 1080, height: 1080, backgroundColor: YEL, backgroundImage: lit(f, 1080, 1080), fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: `${f.y}px ${f.x}px 34px`, position: 'relative' }}>
      <Ground src={ground} w={1080} h={1080} />
      <Grain />
      <Print data={data} src={src} w={f.w} h={f.h} />
      <Col style={{ marginTop: 14, flexShrink: 0 }}>
        <Band size={fitUnbounded(data.stamp, W, 84, 60)} color={data.accentBg || LOST}>{data.stamp}</Band>
      </Col>
      <Txt style={{ ...name(32), marginTop: 4, flexShrink: 0 }}>{data.coverLine}</Txt>
      <Row style={{ marginTop: 12, width: W, height: 132, flexShrink: 0 }}>
        <MapTile data={data} w={400} h={132} />
        <Col style={{ marginLeft: 16, width: W - 416 }}>
          <Where data={data} size={17} width={W - 416} lines={3} />
        </Col>
      </Row>
      <Col style={{ marginTop: 10, width: W, flexShrink: 0 }}>
        <Advice data={data} size={18} width={W} lines={2} />
      </Col>
      <Col style={{ flexGrow: 1 }} />
      <ContactPanel data={data} w={W} k={1.42} />
    </Col>
  );
}

function Story({ data, src, ground }) {
  const W = 968;
  const f = SOCIAL_FRAMES.story;
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: YEL, backgroundImage: lit(f, 1080, 1920), fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: `${f.y}px ${f.x}px 130px`, position: 'relative' }}>
      <Ground src={ground} w={1080} h={1920} />
      <Grain />
      <Print data={data} src={src} w={f.w} h={f.h} />
      <Col style={{ marginTop: 30, flexShrink: 0 }}>
        <Band size={fitUnbounded(data.stamp, W, 150, 80)} color={data.accentBg || LOST}>{data.stamp}</Band>
      </Col>
      <Txt style={{ ...name(46), marginTop: 10, flexShrink: 0 }}>{data.coverLine}</Txt>
      <Row style={{ marginTop: 22, width: W, height: 270, flexShrink: 0 }}>
        <MapTile data={data} w={440} h={270} radius={20} />
        <Col style={{ marginLeft: 24, width: W - 464 }}>
          <Where data={data} size={24} width={W - 464} lines={4} />
        </Col>
      </Row>
      <Col style={{ marginTop: 16, width: W, flexShrink: 0 }}>
        <Advice data={data} size={25} width={W} lines={3} healthLines={2} />
      </Col>
      <Col style={{ flexGrow: 1 }} />
      <ContactPanel data={data} w={W} k={W / 516} />
    </Col>
  );
}

/**
 * @param {{data:object, size:'og'|'square'|'story', photoSrc:string|null, groundSrc?:string|null}} props
 */
export function SocialCard({ data, size = 'og', photoSrc, groundSrc = null }) {
  const src = photoSrc ?? data.photos?.[0]?.src ?? null;
  if (size === 'square') return <Square data={data} src={src} ground={groundSrc} />;
  if (size === 'story') return <Story data={data} src={src} ground={groundSrc} />;
  return <Og data={data} src={src} ground={groundSrc} />;
}

export default SocialCard;
