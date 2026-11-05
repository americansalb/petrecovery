import React from 'react';
import { fitUnbounded, STICKER } from '../flyers/plan';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers, second
 * design" (the three Share boards): the sticker on yellow at the three
 * sizes phones pass around. The photo as a round sticker with a cream
 * ring and a navy shadow; LOST in Unbounded; the name; where and when;
 * what to look for; the phone number in a navy pill. og 1200×630 (sticker
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

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;

const disp = (size, color = NAVY) => ({ fontFamily: 'Unbounded', fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color, whiteSpace: 'nowrap' });
const name = (size, color = NAVY) => ({ fontFamily: 'Inter', fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: -size * 0.02, color, whiteSpace: 'nowrap' });
const eyebrow = (size, color = NAVY) => ({ fontFamily: 'Inter', fontWeight: 700, fontSize: size, letterSpacing: size * 0.14, textTransform: 'uppercase', color });
const body = (size, color = NAVY, weight = 500) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.4, color });

const rewardLine = (data) => (data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`);

function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

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
        <Txt style={disp(fitUnbounded(data.stamp, W, 132, 60))}>{data.stamp}</Txt>
        <Txt style={{ ...name(34), marginTop: 12, width: W, lineClamp: 1 }}>{data.coverLine}</Txt>
        <Col style={{ marginTop: 10 }}>
          <LastSeen data={data} size={15} width={W} align="left" />
        </Col>
        <Col style={{ marginTop: 8 }}>
          <Facts data={data} size={17} width={W} align="left" />
        </Col>
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
    <Col style={{ width: 1080, height: 1080, backgroundColor: YEL, fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: '56px 40px 40px' }}>
      <Sticker data={data} src={src} size={560} />
      <Txt style={{ ...disp(fitUnbounded(data.stamp, W, 132, 60)), marginTop: 26 }}>{data.stamp}</Txt>
      <Txt style={{ ...name(36), marginTop: 10, lineClamp: 1 }}>{data.coverLine}</Txt>
      <Col style={{ marginTop: 10 }}>
        <LastSeen data={data} size={16} width={W} />
      </Col>
      <Col style={{ marginTop: 6 }}>
        <Facts data={data} size={18} width={860} />
      </Col>
      <Col style={{ flexGrow: 1 }} />
      <Row style={{ width: W, alignItems: 'center' }}>
        <Pill data={data} w={data.qrDataUrl ? W - 116 : W} phoneMax={50} eye={13} />
        {data.qrDataUrl ? (
          <Col style={{ marginLeft: 16 }}>
            <QrTile data={data} size={100} />
          </Col>
        ) : null}
      </Row>
    </Col>
  );
}

function Story({ data, src }) {
  const W = 968;
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: YEL, fontFamily: 'Inter', color: NAVY, alignItems: 'center', padding: '150px 56px 140px' }}>
      <Sticker data={data} src={src} size={820} />
      <Txt style={{ ...disp(fitUnbounded(data.stamp, W, 200, 80)), marginTop: 40 }}>{data.stamp}</Txt>
      <Txt style={{ ...name(50), marginTop: 14, lineClamp: 1 }}>{data.coverLine}</Txt>
      <Col style={{ marginTop: 14 }}>
        <LastSeen data={data} size={22} width={W} />
      </Col>
      <Col style={{ marginTop: 8 }}>
        <Facts data={data} size={26} width={880} />
      </Col>
      <Col style={{ flexGrow: 1 }} />
      <Row style={{ width: W, alignItems: 'center' }}>
        <Pill data={data} w={data.qrDataUrl ? W - 166 : W} phoneMax={72} eye={17} />
        {data.qrDataUrl ? (
          <Col style={{ marginLeft: 16 }}>
            <QrTile data={data} size={150} />
          </Col>
        ) : null}
      </Row>
      <Txt style={{ ...body(18, SOFT, 600), marginTop: 22 }}>reunitepets.org/cases/{data.caseNumber}</Txt>
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
