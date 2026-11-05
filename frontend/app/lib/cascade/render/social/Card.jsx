import React from 'react';
import { fitFraunces, planWord, FRAUNCES } from '../flyers/plan';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers, second
 * design" (the three Share boards): the cover at the three sizes phones
 * pass around. The photo bleeds, with nothing on it; on the paper beside
 * or below it, LOST in red and "Milo, a tabby cat" in the italic, both in
 * Fraunces, then where and when, what to look for, and the phone number
 * in the same face. og 1200×630 (photo left), square 1080×1080 and story
 * 1080×1920 (photo above). SOCIAL_FRAMES in ../flyers/plan.js holds each
 * photo frame.
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const PAPER = '#f7f4ee';
const INK = '#1c1917';
const MUTED = '#78716c';
const RED = '#b91c1c';
const LINE = '#ddd6ca';
const NOPHOTO = '#e9e2d6';

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;

const serif = (size, color = INK) => ({ fontFamily: 'Fraunces', fontWeight: 900, fontSize: size, lineHeight: FRAUNCES.line, letterSpacing: -size * 0.03, color, whiteSpace: 'nowrap' });
const ital = (size, color = INK) => ({ fontFamily: 'Fraunces', fontWeight: 600, fontStyle: 'italic', fontSize: size, lineHeight: 1.05, letterSpacing: -size * 0.01, color, whiteSpace: 'nowrap' });
const body = (size, color = INK, weight = 500) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.4, color });
const eyebrow = (size, color = MUTED) => ({ fontFamily: 'Inter', fontWeight: 700, fontSize: size, letterSpacing: size * 0.15, textTransform: 'uppercase', color });

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

function Photo({ src, w, h, data }) {
  if (src) return <img src={src} width={w} height={h} style={{ width: w, height: h, objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <Col style={{ width: w, height: h, backgroundColor: NOPHOTO, justifyContent: 'center', padding: Math.round(w * 0.07), flexShrink: 0 }}>
      <Txt style={{ ...eyebrow(Math.round(w * 0.024), MUTED), marginBottom: 14 }}>No photo yet. Please go by this.</Txt>
      <Txt style={{ ...ital(Math.round(w * 0.05)), whiteSpace: 'normal', lineHeight: 1.15 }}>{data.description || data.lookFor}</Txt>
    </Col>
  );
}

/** LOST and the cover line on one baseline, or stacked when the line is long. */
function WordLine({ data, width, wordMax, lineMax, lineMin, gap }) {
  const word = planWord({ stamp: data.stamp, coverLine: data.coverLine, width, wordMax, lineMax, lineMin, gap });
  if (word.stacked) {
    return (
      <Col style={{ width }}>
        <Txt style={serif(word.wordSize, data.accentDeep)}>{data.stamp}</Txt>
        <Txt style={{ ...ital(word.lineSize), marginTop: word.lineSize * 0.3 }}>{data.coverLine}</Txt>
      </Col>
    );
  }
  return (
    <Row style={{ width, alignItems: 'baseline' }}>
      <Txt style={serif(word.wordSize, data.accentDeep)}>{data.stamp}</Txt>
      <Txt style={{ ...ital(word.lineSize), marginLeft: gap }}>{data.coverLine}</Txt>
    </Row>
  );
}

/** "LAST SEEN  Wed, Nov 4  Sach'a Yuntas": one line on a wide panel, the place on its own line on a narrow one. */
function LastSeen({ data, size, width }) {
  const narrow = width < 600;
  const place = <Txt style={{ ...body(size, MUTED, 400), width, lineClamp: 1 }}>{data.lastSeenArea}</Txt>;
  return (
    <Col style={{ width }}>
      <Row style={{ alignItems: 'baseline', ...body(size, MUTED, 400), whiteSpace: 'nowrap' }}>
        <Txt style={{ ...eyebrow(size * 0.78, RED), marginRight: size * 0.6, flexShrink: 0 }}>Last seen</Txt>
        {data.lastSeenWhen ? <Txt style={{ fontWeight: 600, color: INK, marginRight: size * 0.6, flexShrink: 0 }}>{data.lastSeenWhen}</Txt> : null}
        {narrow ? null : place}
      </Row>
      {narrow ? <Col style={{ marginTop: size * 0.2 }}>{place}</Col> : null}
    </Col>
  );
}

function Facts({ data, size, width, lines = 2 }) {
  return <Txt style={{ ...body(size), width, lineClamp: lines }}>{lookForLine(data)}</Txt>;
}

function Contact({ data, eyebrowSize, phoneMax, maxW, padTop = 14, align = 'flex-start', rule = true }) {
  const phone = fitFraunces(data.contactValue, maxW, phoneMax, phoneMax * 0.3);
  const ruleStyle = rule ? { borderTop: `1px solid ${LINE}` } : {};
  return (
    <Col style={{ ...ruleStyle, paddingTop: padTop, alignItems: align }}>
      <Txt style={{ ...eyebrow(eyebrowSize), marginBottom: eyebrowSize * 0.45 }}>{contactEyebrow(data)}</Txt>
      <Txt style={serif(phone)}>{data.contactValue}</Txt>
    </Col>
  );
}

function Reward({ data, size }) {
  if (!data.reward) return null;
  return <Txt style={eyebrow(size, RED)}>{data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`}</Txt>;
}

function Qr({ data, size, capSize }) {
  if (!data.qrDataUrl) return null;
  return (
    <Col style={{ width: size + 8, alignItems: 'center', flexShrink: 0 }}>
      <img src={data.qrDataUrl} width={size} height={size} style={{ width: size, height: size }} />
      <Txt style={{ ...eyebrow(capSize, MUTED), letterSpacing: capSize * 0.08, textAlign: 'center', justifyContent: 'center', marginTop: 8, lineHeight: 1.25 }}>Scan to report a sighting</Txt>
    </Col>
  );
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src }) {
  const W = 426; // the panel inside its padding
  return (
    <Row style={{ width: 1200, height: 630, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={690} h={630} data={data} />
      <Col style={{ width: 510, padding: '40px 42px 36px 42px' }}>
        <WordLine data={data} width={W} wordMax={150} lineMax={30} lineMin={18} gap={14} />
        <Col style={{ marginTop: 18 }}>
          <LastSeen data={data} size={15} width={W} />
        </Col>
        <Col style={{ marginTop: 8 }}>
          <Facts data={data} size={17} width={W} />
        </Col>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={12} phoneMax={56} maxW={W} />
        <Row style={{ marginTop: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Reward data={data} size={12} />
          <Txt style={body(13, MUTED, 600)}>reunitepets.org</Txt>
        </Row>
      </Col>
    </Row>
  );
}

function Square({ data, src }) {
  const W = 1000;
  return (
    <Col style={{ width: 1080, height: 1080, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={1080} h={640} data={data} />
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '30px 40px 40px' }}>
        <WordLine data={data} width={W} wordMax={190} lineMax={34} lineMin={20} gap={16} />
        <Col style={{ flexGrow: 1 }} />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Col style={{ width: 560 }}>
            <LastSeen data={data} size={16} width={560} />
            <Col style={{ marginTop: 8 }}>
              <Facts data={data} size={18} width={560} />
            </Col>
          </Col>
          <Col style={{ alignItems: 'flex-end' }}>
            <Contact data={data} eyebrowSize={12} phoneMax={62} maxW={400} padTop={0} align="flex-end" rule={false} />
            <Row style={{ marginTop: 8, alignItems: 'baseline' }}>
              <Reward data={data} size={12} />
              <Txt style={{ ...body(13, MUTED, 600), marginLeft: 14 }}>reunitepets.org</Txt>
            </Row>
          </Col>
        </Row>
      </Col>
    </Col>
  );
}

function Story({ data, src }) {
  const W = 968;
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={1080} h={1150} data={data} />
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '40px 56px 140px' }}>
        <WordLine data={data} width={W} wordMax={190} lineMax={44} lineMin={26} gap={18} />
        <Col style={{ marginTop: 24 }}>
          <LastSeen data={data} size={22} width={W} />
        </Col>
        <Col style={{ marginTop: 10 }}>
          <Facts data={data} size={24} width={W} />
        </Col>
        <Col style={{ flexGrow: 1 }} />
        <Row style={{ borderTop: `1px solid ${LINE}`, paddingTop: 20, justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Col>
            <Contact data={data} eyebrowSize={16} phoneMax={96} maxW={data.qrDataUrl ? 760 : W} padTop={0} rule={false} />
            <Row style={{ marginTop: 14, alignItems: 'baseline' }}>
              <Reward data={data} size={15} />
              <Txt style={{ ...body(16, MUTED, 600), marginLeft: data.reward ? 18 : 0 }}>reunitepets.org/cases/{data.caseNumber}</Txt>
            </Row>
          </Col>
          <Qr data={data} size={150} capSize={12} />
        </Row>
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
