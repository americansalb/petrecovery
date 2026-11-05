import React from 'react';
import { fitAnton, ANTON_LINE } from '../flyers/plan';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers, second
 * design" (the three Share boards): the poster at the three sizes phones
 * pass around. Three things, each enormous: LOST and the species in
 * Anton, LOST in red; the photo filling its frame (cut to the frame's
 * shape around the pet before it gets here) with the red reward disc over
 * its corner; the phone number in the same face. Then, small, the name,
 * what to look for, where and when. White ground, black type, one red.
 * og 1200×630, square 1080×1080, story 1080×1920 (SOCIAL_FRAMES in
 * ../flyers/plan.js holds each photo frame).
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const INK = '#0f172a';
const SOFT = '#475569';
const PAPER = '#ffffff';
const CELL = '#f1f5f9';

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;

const anton = (size, color = INK) => ({ fontFamily: 'Anton', fontSize: size, lineHeight: ANTON_LINE, letterSpacing: -size * 0.01, color, whiteSpace: 'nowrap' });
const name = (size, color = INK) => ({ fontFamily: 'Inter', fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: -size * 0.03, color });
const body = (size, color = INK, weight = 600) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.3, color });
const eyebrow = (size, color = SOFT) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: size,
  letterSpacing: size * 0.14,
  textTransform: 'uppercase',
  color,
});

/** Width estimate for Inter Black so a long name shrinks instead of wrapping. */
function fitName(text, maxW, base, min) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.32;
    else if ('mwMW@'.includes(ch)) em += 0.95;
    else if (ch === ' ') em += 0.28;
    else if (ch >= 'a' && ch <= 'z') em += 0.58;
    else if (ch >= 'A' && ch <= 'Z') em += 0.7;
    else em += 0.62;
  }
  return Math.max(min, Math.min(base, maxW / (em * 1.06 || 1)));
}

function contactEyebrow(data, short = false) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return short ? `${who} Call or text` : `${who} Call or text, any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return short ? `${who} Email` : `${who} Email, any hour`;
  return `${who} Report it at`;
}

function lookForLine(data) {
  const facts = data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : '';
  return `${data.lookFor || ''}${facts}`.trim() || data.description || '';
}

/* ------------------------------------------------------------- primitives */

/** LOST DOG on one line, LOST in red, as large as `maxW` allows. */
function WordLine({ data, maxW, base }) {
  const size = fitAnton(data.headlineBig, maxW, base, base * 0.4);
  return (
    <Row style={{ ...anton(size), height: size * ANTON_LINE, alignItems: 'flex-end' }}>
      <span style={{ color: data.accent }}>{data.stamp}</span>
      <span>{` ${data.speciesLabel}`}</span>
    </Row>
  );
}

/** LOST over DOG, for a narrow column. */
function WordStack({ data, maxW, base }) {
  const longest = data.speciesLabel.length > data.stamp.length ? data.speciesLabel : data.stamp;
  const size = fitAnton(longest, maxW, base, base * 0.4);
  return (
    <Col>
      <Txt style={{ ...anton(size, data.accent), height: size * ANTON_LINE, alignItems: 'flex-end' }}>{data.stamp}</Txt>
      <Txt style={{ ...anton(size), height: size * ANTON_LINE, alignItems: 'flex-end' }}>{data.speciesLabel}</Txt>
    </Col>
  );
}

function RewardDisc({ data, size, top, right }) {
  if (!data.reward) return null;
  const amount = data.reward !== 'REWARD';
  const big = amount ? data.reward : 'REWARD';
  const small = amount ? 'Reward' : 'Offered';
  const bigSize = fitAnton(big, size * 0.78, size * 0.36, size * 0.2);
  return (
    <Col
      style={{
        position: 'absolute',
        top,
        right,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: data.accent,
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-8deg)',
      }}
    >
      <Txt style={{ ...anton(bigSize, PAPER), lineHeight: 1 }}>{big}</Txt>
      <Txt style={{ ...eyebrow(size * 0.085, PAPER), marginTop: size * 0.02 }}>{small}</Txt>
    </Col>
  );
}

function Photo({ src, w, h, data, disc, discTop, discRight }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, flexShrink: 0 }}>
      {src ? (
        <img src={src} width={w} height={h} style={{ width: w, height: h, objectFit: 'cover' }} />
      ) : (
        <Col style={{ width: w, height: h, backgroundColor: CELL, justifyContent: 'center', padding: Math.round(w * 0.07) }}>
          <Txt style={{ ...eyebrow(Math.round(w * 0.026), SOFT), marginBottom: 14 }}>No photo yet. Please go by this.</Txt>
          <Txt style={{ ...name(Math.round(w * 0.055)), lineHeight: 1.12 }}>{data.description || data.lookFor}</Txt>
        </Col>
      )}
      <RewardDisc data={data} size={disc} top={discTop} right={discRight} />
    </div>
  );
}

function LastSeen({ data, size, width }) {
  return (
    <Row style={{ width, alignItems: 'baseline', ...body(size, SOFT, 400), whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <Txt style={{ ...eyebrow(size * 0.82, data.accent), marginRight: size * 0.5, flexShrink: 0 }}>Last seen</Txt>
      {data.lastSeenWhen ? <Txt style={{ fontWeight: 700, color: INK, marginRight: size * 0.5, flexShrink: 0 }}>{data.lastSeenWhen}</Txt> : null}
      <Txt style={{ lineClamp: 1 }}>{data.lastSeenArea}</Txt>
    </Row>
  );
}

function Contact({ data, eyebrowSize, valueSize, maxW, rule = 3, padTop = 12, short = false, align = 'flex-start' }) {
  const value = fitAnton(data.contactValue, maxW, valueSize, valueSize * 0.35);
  // satori chokes on a style key set to undefined, so the rule is added only when drawn.
  const ruleStyle = rule ? { borderTop: `${rule}px solid ${INK}` } : {};
  return (
    <Col style={{ ...ruleStyle, paddingTop: padTop, alignItems: align }}>
      <Txt style={{ ...eyebrow(eyebrowSize, data.accent), marginBottom: eyebrowSize * 0.3 }}>{contactEyebrow(data, short)}</Txt>
      <Txt style={{ ...anton(value), lineHeight: 1, letterSpacing: value * 0.005 }}>{data.contactValue}</Txt>
    </Col>
  );
}

function Qr({ data, size, capSize }) {
  if (!data.qrDataUrl) return null;
  return (
    <Col style={{ width: size + 8, alignItems: 'center', flexShrink: 0 }}>
      <img src={data.qrDataUrl} width={size} height={size} style={{ width: size, height: size }} />
      <Txt style={{ ...eyebrow(capSize, SOFT), letterSpacing: capSize * 0.08, textAlign: 'center', justifyContent: 'center', marginTop: 8, lineHeight: 1.25 }}>Scan to report a sighting</Txt>
    </Col>
  );
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src }) {
  return (
    <Row style={{ width: 1200, height: 630, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={560} h={630} data={data} disc={124} discTop={24} discRight={-22} />
      <Col style={{ width: 640, padding: '40px 44px 40px 52px' }}>
        <WordStack data={data} maxW={544} base={190} />
        <Txt style={{ ...name(fitName(data.petName, 544, 44, 26)), marginTop: 16 }}>{data.petName}</Txt>
        <Col style={{ marginTop: 8 }}>
          <LastSeen data={data} size={16} width={544} />
        </Col>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={13} valueSize={66} maxW={544} />
      </Col>
    </Row>
  );
}

function Square({ data, src }) {
  return (
    <Col style={{ width: 1080, height: 1080, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={1080} h={640} data={data} disc={150} discTop={28} discRight={28} />
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '30px 40px 40px' }}>
        <WordLine data={data} maxW={1000} base={230} />
        <Col style={{ flexGrow: 1 }} />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Col style={{ width: 600 }}>
            <Txt style={name(fitName(data.petName, 600, 48, 28))}>{data.petName}</Txt>
            <Txt style={{ ...body(18), width: 600, lineClamp: 2, marginTop: 8 }}>{lookForLine(data)}</Txt>
            <Col style={{ marginTop: 6 }}>
              <LastSeen data={data} size={16} width={600} />
            </Col>
          </Col>
          <Contact data={data} eyebrowSize={13} valueSize={64} maxW={360} rule={0} padTop={0} short align="flex-end" />
        </Row>
      </Col>
    </Col>
  );
}

function Story({ data, src }) {
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Col style={{ padding: '140px 56px 0' }}>
        <WordLine data={data} maxW={968} base={281} />
      </Col>
      <Col style={{ marginTop: 28 }}>
        <Photo src={src} w={1080} h={1010} data={data} disc={170} discTop={32} discRight={32} />
      </Col>
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '30px 56px 140px' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Col style={{ width: data.qrDataUrl ? 800 : 968, marginRight: 32 }}>
            <Txt style={name(fitName(data.petName, 800, 60, 32))}>{data.petName}</Txt>
            <Txt style={{ ...body(22), width: data.qrDataUrl ? 800 : 968, lineClamp: 2, marginTop: 10 }}>{lookForLine(data)}</Txt>
            <Col style={{ marginTop: 8 }}>
              <LastSeen data={data} size={19} width={data.qrDataUrl ? 800 : 968} />
            </Col>
          </Col>
          <Qr data={data} size={120} capSize={11} />
        </Row>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={16} valueSize={112} maxW={968} rule={4} padTop={16} />
      </Col>
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
