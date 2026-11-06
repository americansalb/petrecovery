import React from 'react';
import { fitUnbounded, fitInter, interEm, eyebrowW, PRINT, BAND, COLUMN, ADVICE, bandBox, printInner, planSocial, lookForLine } from '../flyers/plan';
import { grainDataUrl, GRAIN_TILE } from '../textures';
import { GROUND, LIGHT } from '../ground';

/**
 * Share images, the Claude Design canvas "Lost Pet Flyers, the sticker"
 * at the three sizes phones pass around, on the same ground as the paper
 * (../ground.js): the brand's yellow lit from behind the photo and
 * deepening to amber at the corners, sun rays from the same point,
 * caution stripes along the top and the foot, grain over it all. LOST in
 * Unbounded, cream on a red band set a touch askew, the name beside it
 * with the reward and "Needs medication" as pills under the name; the
 * pet's photo as a print in a cream mat with a hard navy shadow, nothing
 * ever drawn over it, as wide as the photo's own shape asks (`frame`,
 * from planSocial in ../flyers/plan.js); beside it where and when, the
 * map and what to look for; "If you see Max" on a cream note card, the
 * full width, never cut; then the contact panel on navy (the link
 * preview, which is itself the link, keeps the plain phone pill). og
 * 1200×630 (print left, words right), square 1080×1080 and story
 * 1080×1920 (the head, then the print beside the facts). The rays and
 * stripes come in as one PNG (`groundSrc`, drawn by ../ground.js in
 * index.js), since satori draws no polygons.
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const YEL = GROUND.yellow;
const NAVY = GROUND.ink; // the brand's brown; the name stays from when it was the site's slate
const CREAM = '#fffbea';
const SOFT = GROUND.soft;
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

/** The reward and "Needs medication" as pills in a row that wraps: beside the name, never on the photo. */
function Tags({ data, size, marginTop = 0 }) {
  const items = [];
  if (data.needsMedication) items.push({ red: true, text: 'Needs medication' });
  if (data.reward) items.push({ red: false, text: rewardLine(data) });
  if (!items.length) return null;
  const b = Math.max(2, Math.round(size * 0.2));
  return (
    <Row style={{ flexWrap: 'wrap', marginTop, marginBottom: -Math.round(size * 0.5) }}>
      {items.map((t) => (
        <Row key={t.text} style={{ backgroundColor: t.red ? LOST : CREAM, border: `${b}px solid ${NAVY}`, borderRadius: 999, padding: `${Math.round(size * 0.45)}px ${Math.round(size * 1.1)}px`, marginRight: Math.round(size * 0.7), marginBottom: Math.round(size * 0.5), ...eyebrow(size, t.red ? CREAM : NAVY), whiteSpace: 'nowrap' }}>
          {t.text}
        </Row>
      ))}
    </Row>
  );
}

/** The photo as a print: a cream mat in a navy edge, a hard navy shadow, nothing over it. Without a photo, the description on the print. */
function Print({ data, src, w, h }) {
  const off = Math.round(w * PRINT.shadow);
  const r = Math.round(w * PRINT.radius);
  const { edge, mat, w: pw, h: ph } = printInner(w, h, 1.5); // a 3 px edge
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
function ContactPanel({ data, w, k: kBase, scale = 1 }) {
  // Given more height (a thin report), the type grows with `scale` and the tile, link and padding at half that rate (see Flyer.jsx).
  const k = kBase * scale;
  const kq = kBase * (1 + (scale - 1) * 0.5);
  const padX = Math.round(18 * kq);
  const qr = data.qrDataUrl ? Math.round(58 * kq) : 0;
  const mainIsLink = !data.hasPhone && !data.email;
  const link = mainIsLink ? '' : data.caseUrlLabel;
  const linkSize = Math.round(10 * kq);
  const linkW = link ? Math.ceil(Math.max(interEm(link) * linkSize, eyebrowW(LINK_EYEBROW, 7.5 * kq))) : 0;
  const leftW = w - padX * 2 - (qr ? qr + Math.round(12 * kq) : 0) - (linkW ? linkW + Math.round(9 * kq) : 0);
  const phone = fitUnbounded(data.contactValue, leftW, 34.5 * k, 10 * k);
  const emailLine = data.hasPhone && data.email ? `or email ${data.email}` : '';
  const emailSize = emailLine ? fitInter(emailLine, leftW, 9.75 * k, 7 * k) : 0;
  const eyebrowText = contactEyebrow(data);
  const eyebrowSize = Math.max(6.5 * kBase, Math.min(9 * k, (leftW / eyebrowW(eyebrowText, 1)) * 0.98));
  return (
    <Row style={{ width: w, height: Math.round(84 * k), backgroundColor: NAVY, borderRadius: Math.round(20 * k), padding: `0 ${padX}px`, alignItems: 'center' }}>
      <Col style={{ width: leftW }}>
        <Txt style={{ ...eyebrow(eyebrowSize, YEL), whiteSpace: 'nowrap' }}>{eyebrowText}</Txt>
        <Txt style={{ ...disp(phone, CREAM), marginTop: Math.round(6 * k) }}>{data.contactValue}</Txt>
        {emailLine ? <Txt style={{ ...body(emailSize, CREAM, 500), marginTop: Math.round(6 * k), lineHeight: 1.2, whiteSpace: 'nowrap' }}>{emailLine}</Txt> : null}
      </Col>
      {qr ? (
        <Col style={{ marginLeft: Math.round(12 * kq) }}>
          <QrTile data={data} size={qr} />
        </Col>
      ) : null}
      {link ? (
        <Col style={{ marginLeft: Math.round(qr ? 9 * kq : 12 * kq), width: linkW }}>
          <Txt style={eyebrow(7.5 * kq, YEL)}>{LINK_EYEBROW}</Txt>
          <Txt style={{ ...body(linkSize, CREAM, 700), marginTop: Math.round(3 * kq), lineHeight: 1.2, whiteSpace: 'nowrap' }}>{link}</Txt>
        </Col>
      ) : null}
    </Row>
  );
}

/** Without a map on record, the tile is the link: the QR code as large as the card allows over "Scan for the map and updates" and the short link (see Flyer.jsx LinkCard). */
function LinkCard({ data, w, h, radius, k = 1.5 }) {
  const pad = Math.round(8 * k);
  const eye = 7 * k;
  const link = fitInter(data.caseUrlLabel, w - pad * 2, 9 * k, 6 * k);
  const words = eye * 1.3 + 3 + link * 1.2;
  const qr = data.qrDataUrl ? Math.floor(Math.min(w - pad * 2, h - pad * 2 - words - 8)) : 0;
  const big = qr >= 40 * k;
  return (
    <Col style={{ width: w, height: h, borderRadius: radius, backgroundColor: CREAM, border: `3px solid ${NAVY}`, alignItems: 'center', justifyContent: 'center', padding: `0 ${pad}px`, flexShrink: 0 }}>
      {big ? <img src={data.qrDataUrl} width={qr} height={qr} style={{ width: qr, height: qr, marginBottom: Math.round(6 * k) }} /> : null}
      <Txt style={{ ...eyebrow(eye, SOFT), whiteSpace: 'nowrap' }}>{big ? 'Scan for the map' : 'Map at the link'}</Txt>
      <Txt style={{ ...body(link, NAVY, 700), marginTop: 3, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{data.caseUrlLabel}</Txt>
    </Col>
  );
}

/**
 * The last-seen map (see Flyer.jsx MapTile). The cascade's tiles are in
 * points, drawn here at 1.5× so street names stay readable on a screen.
 */
export function MapTile({ data, w, h, radius = 14, k = 1.5 }) {
  const m = data.map;
  if (!m) return <LinkCard data={data} w={w} h={h} radius={radius} k={k} />;
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

/** Beside the print, the facts as planColumn laid them out (plan.js) to fill the column; `k` is the column's scale (its body size over the sheet's). */
function Beside({ data, k, width, height, col, radius = 14 }) {
  const size = col.size;
  return (
    <Col style={{ width, height, justifyContent: 'space-between' }}>
      <Col>
        <Txt style={eyebrow(COLUMN.eyebrow * k * col.kt)}>Last seen</Txt>
        {data.lastSeenWhen ? <Txt style={{ ...body(COLUMN.date * k * col.kt, NAVY, 700), marginTop: 2, lineHeight: 1.2 }}>{data.lastSeenWhen}</Txt> : null}
        <Clamp lines={3} style={{ ...body(COLUMN.address * k * col.kt, SOFT, 500), width, lineHeight: 1.3 }}>{data.lastSeenArea}</Clamp>
      </Col>
      <Col style={{ marginTop: Math.round(col.gap) }}>
        <MapTile data={data} w={width} h={col.tileH} radius={radius} k={k} />
      </Col>
      <Col style={{ marginTop: Math.round(col.gap) }}>
        <Clamp lines={col.bodyLines} style={{ ...body(size), width, lineHeight: COLUMN.lineHeight }}>{lookForLine(data)}</Clamp>
        {data.comesTo && col.comesLines ? <Clamp lines={col.comesLines} style={{ ...body(size * COLUMN.comes, SOFT, 500), width, marginTop: 4, lineHeight: 1.3 }}>{data.comesTo}</Clamp> : null}
      </Col>
    </Col>
  );
}

/** The head: the band, and beside it the name with the pills under it. `w` is the whole head's width. */
function Head({ data, w, bandSize, nameMax, tagSize, gap }) {
  const box = bandBox(bandSize, data.stamp);
  const nameW = w - box.w - box.off - gap;
  return (
    <Row style={{ width: w, alignItems: 'center', height: box.h + box.off }}>
      <Band size={bandSize} color={data.accentBg || LOST}>{data.stamp}</Band>
      <Col style={{ marginLeft: gap, width: nameW, justifyContent: 'center' }}>
        <Clamp lines={2} style={{ ...name(fitInter(data.coverLine, nameW, nameMax, nameMax * 0.55)), whiteSpace: 'normal', width: nameW, lineHeight: 1.05 }}>{data.coverLine}</Clamp>
        <Tags data={data} size={tagSize} marginTop={Math.round(tagSize * 0.6)} />
      </Col>
    </Row>
  );
}

/** Where and when, then what to look for, beside the map. */
function Where({ data, size, width, lines = 3 }) {
  return (
    <Col style={{ width, justifyContent: 'center' }}>
      <Txt style={eyebrow(size * 0.72)}>Last seen</Txt>
      {data.lastSeenWhen ? <Txt style={{ ...body(size * 1.15, NAVY, 700), marginTop: 2, lineHeight: 1.2 }}>{data.lastSeenWhen}</Txt> : null}
      <Clamp lines={2} style={{ ...body(size * 0.92, SOFT, 500), width, lineHeight: 1.3 }}>{data.lastSeenArea}</Clamp>
      <Clamp lines={lines} style={{ ...body(size * 0.95), width, marginTop: size * 0.4, lineHeight: 1.35 }}>{lookForLine(data)}</Clamp>
    </Col>
  );
}

/** "IF YOU SEE MAX" on a cream note card with a navy edge, as tall as its words at the plan's size (plan.js planAdvice); `k` is the card's scale. */
function Advice({ data, k, width, plan }) {
  const padX = Math.round(ADVICE.padX * k);
  const padY = Math.round(ADVICE.padY * k);
  const edge = Math.round(ADVICE.edge * k);
  const inner = width - padX * 2 - edge * 2;
  return (
    <Col style={{ width, height: plan.h, backgroundColor: CREAM, borderRadius: Math.round(10 * k), border: `${edge}px solid ${NAVY}`, padding: `${padY}px ${padX}px` }}>
      <Txt style={eyebrow(ADVICE.eyebrow * k)}>{`If you see ${data.petName}`}</Txt>
      {data.health && plan.healthLines ? <Clamp lines={plan.healthLines} style={{ ...body(plan.size, LOST, 700), width: inner, lineHeight: 1.3, marginTop: Math.round(2 * k) }}>{data.health}</Clamp> : null}
      <Clamp lines={plan.lines} style={{ ...body(plan.size, NAVY, 600), width: inner, lineHeight: 1.3, marginTop: Math.round(2 * k) }}>{data.ifYouSee}</Clamp>
    </Col>
  );
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src, ground, plan }) {
  const f = plan.frame;
  const W = plan.W;
  return (
    <Col style={{ width: 1200, height: 630, backgroundColor: YEL, backgroundImage: lit(f, 1200, 630), fontFamily: 'Inter', color: NAVY, position: 'relative' }}>
      <Ground src={ground} w={1200} h={630} />
      <Grain />
      <div style={{ position: 'absolute', left: f.x, top: f.y, display: 'flex' }}>
        <Print data={data} src={src} w={f.w} h={f.h} />
      </div>
      <Col style={{ position: 'absolute', left: plan.colX, top: plan.top, width: W }}>
        <Head data={data} w={W} bandSize={plan.bandSize} nameMax={plan.nameMax} tagSize={plan.tag} gap={plan.headGap} />
        <Row style={{ marginTop: Math.round(plan.headToFacts), height: plan.facts, flexShrink: 0 }}>
          {data.map ? <MapTile data={data} w={plan.mapW} h={plan.facts} /> : null}
          <Col style={{ marginLeft: data.map ? 14 : 0, width: plan.whereW }}>
            <Where data={data} size={plan.where} width={plan.whereW} lines={plan.whereLines} />
          </Col>
        </Row>
        <Col style={{ marginTop: Math.round(plan.factsToAdvice), flexShrink: 0 }}>
          <Advice data={data} k={plan.ka} width={W} plan={plan.advice} />
        </Col>
      </Col>
      <Col style={{ position: 'absolute', left: plan.colX, bottom: plan.bottom, width: W }}>
        <Pill data={data} w={W} phoneMax={40} eye={12} />
      </Col>
    </Col>
  );
}

/** The square and the story: the sheet's plan at the card's size (plan.js planCard). */
function Card({ data, src, ground, plan }) {
  const f = plan.frame;
  const { W, H } = plan;
  const whole = W + 2 * plan.side;
  return (
    <Col style={{ width: whole, height: H, backgroundColor: YEL, backgroundImage: lit(f, whole, H), fontFamily: 'Inter', color: NAVY, padding: `${plan.top}px ${plan.side}px ${plan.bottom}px`, position: 'relative' }}>
      <Ground src={ground} w={whole} h={H} />
      <Grain />
      <Head data={data} w={W} bandSize={plan.bandSize} nameMax={plan.nameMax} tagSize={plan.tag} gap={plan.headGap} />
      <Row style={{ marginTop: plan.headToRow, height: f.h, flexShrink: 0 }}>
        <Print data={data} src={src} w={f.w} h={f.h} />
        <Col style={{ marginLeft: plan.colGap, width: plan.colW }}>
          <Beside data={data} k={plan.kc} width={plan.colW} height={f.h} col={plan.col} radius={plan.size === 'story' ? 20 : 14} />
        </Col>
      </Row>
      <Col style={{ marginTop: plan.rowToAdvice, width: W, flexShrink: 0 }}>
        <Advice data={data} k={plan.ka} width={W} plan={plan.advice} />
      </Col>
      <Col style={{ flexGrow: 1 }} />
      <ContactPanel data={data} w={W} k={plan.contact.base} scale={plan.contact.k / plan.contact.base} />
    </Col>
  );
}

/**
 * @param {{data:object, size:'og'|'square'|'story', photoSrc:string|null, groundSrc?:string|null, plan?:object}} props
 */
export function SocialCard({ data, size = 'og', photoSrc, groundSrc = null, plan }) {
  const src = photoSrc ?? data.photos?.[0]?.src ?? null;
  const p = plan || planSocial(size, data.photos?.[0]?.aspect, data);
  if (size === 'og') return <Og data={data} src={src} ground={groundSrc} plan={p} />;
  return <Card data={data} src={src} ground={groundSrc} plan={p} />;
}

export default SocialCard;
