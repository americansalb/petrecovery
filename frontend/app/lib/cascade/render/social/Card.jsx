import React from 'react';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers, second
 * design" (the three Share boards): the printed flyer's bones at the three
 * sizes phones pass around. White ground, the photo filling its frame (cut
 * to the frame's shape around the pet before it gets here), LOST in red and
 * the species in black in Bricolage Grotesque, the name, what to look for,
 * last seen, and the phone as big as the line allows. One design, three
 * sizes: og 1200×630, square 1080×1080, story 1080×1920 (SOCIAL_FRAMES in
 * ../flyers/plan.js holds each photo frame).
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const INK = '#0f172a';
const SOFT = '#475569';
const MUTED = '#64748b';
const PAPER = '#ffffff';
const CELL = '#f1f5f9';

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;

const eyebrow = (size, color = MUTED) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: size,
  letterSpacing: size * 0.16,
  textTransform: 'uppercase',
  color,
});
const display = (size, color = INK) => ({ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: size, lineHeight: 0.92, letterSpacing: -size * 0.035, color });
const body = (size, color = INK, weight = 600) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.35, color });
const mono = (size, color = SOFT) => ({ fontFamily: 'Inter', fontWeight: 600, fontSize: size, lineHeight: 1.3, color });

/** Width estimate for Bricolage Grotesque ExtraBold so a long phone or name shrinks instead of wrapping. */
function fit(text, maxW, base, min) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.34;
    else if ('mwMW@'.includes(ch)) em += 0.98;
    else if (ch === ' ') em += 0.3;
    else if (ch >= 'a' && ch <= 'z') em += 0.58;
    else if (ch >= 'A' && ch <= 'Z') em += 0.7;
    else if (ch >= '0' && ch <= '9') em += 0.62;
    else em += 0.6;
  }
  return Math.max(min, Math.min(base, maxW / (em * 1.06 || 1)));
}

function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email any hour`;
  return `${who} Report it at`;
}

function lookForLine(data) {
  const facts = data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : '';
  return `${data.lookFor || ''}${facts}`.trim() || data.description || '';
}

/* ------------------------------------------------------------- primitives */

function Headline({ data, size, maxW }) {
  const big = fit(data.headlineBig, maxW, size, size * 0.5);
  return (
    <Row style={{ ...display(big), letterSpacing: -big * 0.045, lineHeight: 0.88, whiteSpace: 'nowrap' }}>
      <span style={{ color: data.accent }}>{data.stamp}</span>
      <span>{` ${data.speciesLabel}`}</span>
    </Row>
  );
}

function Photo({ src, w, h, data }) {
  if (src) return <img src={src} width={w} height={h} style={{ width: w, height: h, objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <Col style={{ width: w, height: h, backgroundColor: CELL, justifyContent: 'center', padding: Math.round(w * 0.07), flexShrink: 0 }}>
      <Txt style={{ ...eyebrow(Math.round(w * 0.026), SOFT), marginBottom: 14 }}>No photo yet. Please go by this.</Txt>
      <Txt style={{ ...display(Math.round(w * 0.055)), lineHeight: 1.12, letterSpacing: -0.5 }}>{data.description || data.lookFor}</Txt>
    </Col>
  );
}

function LastSeen({ data, size, width }) {
  return (
    <Col style={{ width }}>
      <Row style={{ alignItems: 'baseline', ...body(size, INK, 600) }}>
        <Txt style={{ ...eyebrow(size * 0.78, data.accent), marginRight: size * 0.6, flexShrink: 0 }}>Last seen</Txt>
        {data.lastSeenWhen ? <Txt style={{ flexShrink: 0 }}>{data.lastSeenWhen}</Txt> : null}
      </Row>
      <Txt style={{ ...body(size, SOFT, 400), width, lineClamp: 1, marginTop: size * 0.15 }}>{data.lastSeenArea}</Txt>
    </Col>
  );
}

function Contact({ data, eyebrowSize, valueSize, maxW, rule = 2, padTop = 16, right = null }) {
  const value = fit(data.contactValue, maxW, valueSize, valueSize * 0.4);
  return (
    <Row style={{ borderTop: `${rule}px solid ${INK}`, paddingTop: padTop, justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Col style={{ minWidth: 0 }}>
        <Txt style={{ ...eyebrow(eyebrowSize, data.accent), marginBottom: eyebrowSize * 0.5 }}>{contactEyebrow(data)}</Txt>
        <Txt style={{ ...display(value), lineHeight: 1, letterSpacing: -value * 0.02, whiteSpace: 'nowrap' }}>{data.contactValue}</Txt>
      </Col>
      {right}
    </Row>
  );
}

function CaseLink({ data, size }) {
  return (
    <Col style={{ ...mono(size), alignItems: 'flex-end', flexShrink: 0, marginLeft: 16 }}>
      <Txt>reunitepets.org/cases/</Txt>
      <Txt>{data.caseNumber}</Txt>
    </Col>
  );
}

function Qr({ data, size, capSize }) {
  if (!data.qrDataUrl) return null;
  return (
    <Col style={{ width: size + 6, alignItems: 'center', flexShrink: 0 }}>
      <img src={data.qrDataUrl} width={size} height={size} style={{ width: size, height: size }} />
      <Txt style={{ ...eyebrow(capSize, SOFT), letterSpacing: capSize * 0.08, textAlign: 'center', justifyContent: 'center', marginTop: 8, lineHeight: 1.25 }}>Scan to report a sighting</Txt>
    </Col>
  );
}

/* ------------------------------------------------------------------ sizes */

function Og({ data, src }) {
  return (
    <Row style={{ width: 1200, height: 630, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={560} h={630} data={data} />
      <Col style={{ width: 640, padding: '46px 48px 44px' }}>
        <Txt style={eyebrow(14)}>Please help us find</Txt>
        <Col style={{ marginTop: 8 }}>
          <Headline data={data} size={108} maxW={544} />
        </Col>
        <Txt style={{ ...display(fit(data.petName, 544, 46, 28)), lineHeight: 1, marginTop: 28 }}>{data.petName}</Txt>
        <Txt style={{ ...body(20), width: 544, lineClamp: 2, marginTop: 10 }}>{lookForLine(data)}</Txt>
        <Col style={{ marginTop: 12 }}>
          <LastSeen data={data} size={16} width={544} />
        </Col>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={13} valueSize={34} maxW={430} right={<Txt style={{ ...body(14, MUTED), flexShrink: 0, marginLeft: 16 }}>reunitepets.org</Txt>} />
      </Col>
    </Row>
  );
}

function Square({ data, src }) {
  return (
    <Col style={{ width: 1080, height: 1080, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Photo src={src} w={1080} h={612} data={data} />
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '34px 48px 40px' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Col style={{ minWidth: 0 }}>
            <Txt style={{ ...eyebrow(14), marginBottom: 8 }}>Please help us find</Txt>
            <Headline data={data} size={116} maxW={600} />
          </Col>
          <Col style={{ width: 360, alignItems: 'flex-end', paddingBottom: 6, marginLeft: 24 }}>
            <Txt style={{ ...display(fit(data.petName, 360, 44, 26)), lineHeight: 1 }}>{data.petName}</Txt>
            <Txt style={{ ...body(17, SOFT), width: 360, textAlign: 'right', justifyContent: 'flex-end', lineClamp: 2, marginTop: 6 }}>{lookForLine(data)}</Txt>
          </Col>
        </Row>
        <Col style={{ marginTop: 20 }}>
          <LastSeen data={data} size={19} width={984} />
        </Col>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={14} valueSize={42} maxW={760} padTop={18} right={<CaseLink data={data} size={14} />} />
      </Col>
    </Col>
  );
}

function Story({ data, src }) {
  return (
    <Col style={{ width: 1080, height: 1920, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Col style={{ padding: '150px 56px 0' }}>
        <Txt style={{ ...eyebrow(17), marginBottom: 10 }}>Please help us find</Txt>
        <Headline data={data} size={172} maxW={968} />
      </Col>
      <Col style={{ marginTop: 36 }}>
        <Photo src={src} w={1080} h={980} data={data} />
      </Col>
      <Col style={{ flexGrow: 1, minHeight: 0, padding: '40px 56px 150px' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Col style={{ width: data.qrDataUrl ? 786 : 968, marginRight: 32 }}>
            <Txt style={{ ...display(fit(data.petName, 780, 64, 36)), lineHeight: 1 }}>{data.petName}</Txt>
            <Txt style={{ ...body(24), width: data.qrDataUrl ? 786 : 968, lineClamp: 2, marginTop: 12 }}>{lookForLine(data)}</Txt>
            <Col style={{ marginTop: 12 }}>
              <LastSeen data={data} size={20} width={data.qrDataUrl ? 786 : 968} />
            </Col>
          </Col>
          <Qr data={data} size={144} capSize={12} />
        </Row>
        <Col style={{ flexGrow: 1 }} />
        <Contact data={data} eyebrowSize={15} valueSize={46} maxW={740} padTop={20} right={<CaseLink data={data} size={15} />} />
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
