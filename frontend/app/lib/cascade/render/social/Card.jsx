import React from 'react';

/**
 * Share images, from the Claude Design canvas "Lost Pet Flyers" (the three
 * Share boards): the same bones as the printed flyer. LOST DOG in flash on
 * a navy band, the photo filling its frame (cut to the frame's shape around
 * the pet before it gets here), HAVE YOU SEEN + the name, what to look for,
 * last seen, and the phone, huge, on navy. One design, three sizes:
 * og 1200×630, square 1080×1080, story 1080×1920 (SOCIAL_FRAMES in
 * ../flyers/plan.js holds each photo frame).
 *
 * satori only understands inline styles and needs display:flex on every
 * element with more than one child, hence the verbosity.
 */

const INK = '#0f172a';
const NAVY = '#0f172a';
const FLASH = '#facc15';
const WASH = '#fefce8';
const CELL = '#f1f5f9';
const SOFT = '#475569';
const ON_NAVY = '#cbd5e1';
const PAPER = '#ffffff';

const Row = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'row', ...style }}>{children}</div>;
const Col = ({ style, children }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
const Txt = ({ style, children }) => <div style={{ display: 'flex', ...style }}>{children}</div>;

const label = (size, color = SOFT) => ({
  fontFamily: 'Archivo',
  fontWeight: 800,
  fontSize: size,
  letterSpacing: size * 0.16,
  textTransform: 'uppercase',
  color,
});
const black = (size, color = INK) => ({ fontFamily: 'Archivo Black', fontSize: size, lineHeight: 0.95, color });
const body = (size, color = INK, weight = 600) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeight: 1.35, color });

/** Width estimate for Archivo Black so a long phone or name shrinks instead of wrapping. */
function fit(text, maxW, base, min) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.36;
    else if ('mwMW@'.includes(ch)) em += 1.02;
    else if (ch === ' ') em += 0.32;
    else if (ch >= 'a' && ch <= 'z') em += 0.62;
    else if (ch >= 'A' && ch <= 'Z') em += 0.78;
    else if (ch >= '0' && ch <= '9') em += 0.66;
    else em += 0.64;
  }
  return Math.max(min, Math.min(base, maxW / (em * 1.06 || 1)));
}

function whereLine(data) {
  return data.lastSeenArea || 'this neighborhood';
}

function contactLabel(data) {
  if (data.hasPhone) return 'Call or text';
  if (/EMAIL/i.test(data.contactVerb || '')) return 'Email';
  return 'Report a sighting at';
}

/** The navy band: PLEASE HELP · the town, LOST DOG, the reward. */
function Band({ data, padTop, padBottom, padX, eyebrow, headSize, rewardSize, width }) {
  const rewardW = data.reward ? (data.reward === 'REWARD' ? rewardSize * 4.4 : rewardSize * 3) : 0;
  const big = fit(data.headlineBig, width - padX * 2 - rewardW - 24, headSize, headSize * 0.5);
  return (
    <Row style={{ width: '100%', backgroundColor: NAVY, padding: `${padTop}px ${padX}px ${padBottom}px`, justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Col style={{ minWidth: 0 }}>
        <Txt style={{ ...label(eyebrow, ON_NAVY), marginBottom: eyebrow * 0.5 }}>Please help · {data.lastSeenArea.split(',').pop().trim() || 'near you'}</Txt>
        <Txt style={{ ...black(big, FLASH), letterSpacing: -big * 0.01 }}>{data.headlineBig}</Txt>
      </Col>
      {data.reward ? (
        <Col style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Txt style={{ ...label(eyebrow, ON_NAVY), marginBottom: eyebrow * 0.3 }}>Reward</Txt>
          <Txt style={black(data.reward === 'REWARD' ? rewardSize * 0.6 : rewardSize, FLASH)}>{data.reward === 'REWARD' ? 'OFFERED' : data.reward}</Txt>
        </Col>
      ) : null}
    </Row>
  );
}

function Photo({ src, w, h, border, data }) {
  return (
    <div style={{ display: 'flex', width: w, height: h, border: `${border}px solid ${INK}`, backgroundColor: CELL, overflow: 'hidden', boxSizing: 'border-box' }}>
      {src ? (
        <img src={src} width={w - border * 2} height={h - border * 2} style={{ width: w - border * 2, height: h - border * 2, objectFit: 'cover' }} />
      ) : (
        <Col style={{ width: '100%', justifyContent: 'center', padding: Math.round(w * 0.06) }}>
          <Txt style={{ ...label(Math.round(w * 0.028)), marginBottom: 12 }}>No photo yet. Please go by this.</Txt>
          <Txt style={{ ...body(Math.round(w * 0.05), INK, 700), lineHeight: 1.2 }}>{data.description || data.lookFor}</Txt>
        </Col>
      )}
    </div>
  );
}

function Qr({ data, size, caption, border = 5, capSize = 15, width }) {
  if (!data.qrDataUrl) return null;
  return (
    <Row style={{ width, border: `${border}px solid ${INK}`, backgroundColor: PAPER, padding: `${Math.round(size * 0.12)}px ${Math.round(size * 0.14)}px`, alignItems: 'center', boxSizing: 'border-box' }}>
      <img src={data.qrDataUrl} width={size} height={size} style={{ width: size, height: size, flexShrink: 0 }} />
      <Txt style={{ ...label(capSize, INK), letterSpacing: capSize * 0.06, lineHeight: 1.3, marginLeft: Math.round(size * 0.14) }}>{caption}</Txt>
    </Row>
  );
}

function PhoneBar({ data, padX, padY, labelSize, phoneSize, urlSize, width, stacked = false }) {
  const phone = fit(data.contactValue, width - padX * 2 - (stacked ? 0 : 420), phoneSize, phoneSize * 0.5);
  if (stacked) {
    return (
      <Col style={{ width: '100%', backgroundColor: NAVY, padding: `${padY}px ${padX}px` }}>
        <Txt style={label(labelSize, ON_NAVY)}>{contactLabel(data)}, any hour</Txt>
        <Txt style={{ ...black(phone, PAPER), marginTop: 10 }}>{data.contactValue}</Txt>
        <Txt style={{ ...body(urlSize, ON_NAVY, 700), marginTop: 10 }}>Updates and the search map: {data.caseUrlLabel}</Txt>
      </Col>
    );
  }
  return (
    <Row style={{ width: '100%', backgroundColor: NAVY, padding: `${padY}px ${padX}px`, justifyContent: 'space-between', alignItems: 'center' }}>
      <Row style={{ alignItems: 'baseline', minWidth: 0 }}>
        <Txt style={{ ...label(labelSize, ON_NAVY), marginRight: 18, flexShrink: 0 }}>{contactLabel(data)}</Txt>
        <Txt style={black(phone, PAPER)}>{data.contactValue}</Txt>
      </Row>
      <Txt style={{ ...body(urlSize, ON_NAVY, 700), flexShrink: 0, marginLeft: 16 }}>{data.caseUrlLabel}</Txt>
    </Row>
  );
}

/* ------------------------------------------------------------------ sizes */

function Square({ data, src }) {
  const W = 1080;
  const name = data.petName.toUpperCase();
  return (
    <Col style={{ width: W, height: 1080, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Band data={data} width={W} padTop={40} padBottom={32} padX={52} eyebrow={20} headSize={124} rewardSize={66} />
      <Row style={{ padding: '20px 52px 0', height: 700, boxSizing: 'border-box' }}>
        <Photo src={src} w={596} h={680} border={6} data={data} />
        <Col style={{ width: 360, marginLeft: 20, height: 680 }}>
          <Txt style={label(18, SOFT)}>Have you seen</Txt>
          <Txt style={{ ...black(fit(name, 360, 84, 36)), marginTop: 2 }}>{name}</Txt>
          <Txt style={{ ...body(22), marginTop: 14 }}>{data.lookFor}</Txt>
          <Col style={{ marginTop: 14, backgroundColor: WASH, padding: '14px 18px', borderLeft: `8px solid ${FLASH}` }}>
            <Txt style={label(14, INK)}>Last seen</Txt>
            <Txt style={{ ...body(21, INK, 700), marginTop: 4 }}>
              {whereLine(data)}
              {data.lastSeenWhen ? `, ${data.lastSeenWhen}` : ''}. Don't chase. Note where and call.
            </Txt>
          </Col>
          <Col style={{ flexGrow: 1 }} />
          <Qr data={data} size={96} caption="Scan or tap the link to report a sighting" width={360} />
        </Col>
      </Row>
      <Col style={{ marginTop: 20, flexGrow: 1 }}>
        <Col style={{ width: '100%', backgroundColor: NAVY, padding: '22px 52px', flexGrow: 1, justifyContent: 'center' }}>
          <Row style={{ alignItems: 'baseline' }}>
            <Txt style={{ ...label(18, ON_NAVY), marginRight: 18, flexShrink: 0 }}>{contactLabel(data)}</Txt>
            <Txt style={black(fit(data.contactValue, 976 - 200, 64, 32), PAPER)}>{data.contactValue}</Txt>
          </Row>
          <Txt style={{ ...body(20, ON_NAVY, 700), marginTop: 8 }}>Updates and the search map: {data.caseUrlLabel}</Txt>
        </Col>
      </Col>
    </Col>
  );
}

function Story({ data, src }) {
  const W = 1080;
  const name = data.petName.toUpperCase();
  return (
    <Col style={{ width: W, height: 1920, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <Col style={{ width: '100%', backgroundColor: NAVY, padding: '150px 56px 36px' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt style={label(22, ON_NAVY)}>Please help · {data.lastSeenArea.split(',').pop().trim() || 'near you'}</Txt>
          {data.reward ? <Txt style={label(22, FLASH)}>Reward {data.reward === 'REWARD' ? 'offered' : data.reward}</Txt> : null}
        </Row>
        <Txt style={{ ...black(fit(data.headlineBig, 968, 150, 80), FLASH), marginTop: 10 }}>{data.headlineBig}</Txt>
      </Col>
      <Col style={{ margin: '24px 56px 0' }}>
        <Photo src={src} w={968} h={906} border={6} data={data} />
      </Col>
      <Row style={{ padding: '24px 56px 0', justifyContent: 'space-between', alignItems: 'flex-end', height: 174, boxSizing: 'border-box' }}>
        <Col style={{ minWidth: 0 }}>
          <Txt style={label(20, SOFT)}>Have you seen</Txt>
          <Txt style={{ ...black(fit(name, 520, 110, 48)), marginTop: 4 }}>{name}</Txt>
        </Col>
        <Txt style={{ ...body(26), textAlign: 'right', maxWidth: 420 }}>{data.factsLine || data.lookFor}</Txt>
      </Row>
      <Col style={{ margin: '20px 56px 0', backgroundColor: WASH, padding: '18px 24px', borderLeft: `10px solid ${FLASH}`, height: 126, boxSizing: 'border-box' }}>
        <Txt style={label(17, INK)}>Last seen {whereLine(data)}{data.lastSeenWhen ? `, ${data.lastSeenWhen}` : ''}</Txt>
        <Txt style={{ ...body(27, INK, 700), marginTop: 4 }}>{data.ifYouSee}</Txt>
      </Col>
      <Col style={{ marginTop: 24, flexGrow: 1 }}>
        <Col style={{ width: '100%', backgroundColor: NAVY, padding: '36px 56px 150px', flexGrow: 1 }}>
          <Txt style={label(22, ON_NAVY)}>{contactLabel(data)}, any hour</Txt>
          <Txt style={{ ...black(fit(data.contactValue, 968, 96, 48), PAPER), marginTop: 10 }}>{data.contactValue}</Txt>
          <Txt style={{ ...body(26, ON_NAVY, 700), marginTop: 10 }}>Updates and the search map: {data.caseUrlLabel}</Txt>
        </Col>
      </Col>
    </Col>
  );
}

function Og({ data, src }) {
  const name = data.petName.toUpperCase();
  return (
    <Row style={{ width: 1200, height: 630, backgroundColor: PAPER, fontFamily: 'Inter', color: INK }}>
      <div style={{ display: 'flex', width: 560, height: 630, backgroundColor: CELL, overflow: 'hidden', borderRight: `6px solid ${INK}`, boxSizing: 'border-box' }}>
        {src ? (
          <img src={src} width={554} height={630} style={{ width: 554, height: 630, objectFit: 'cover' }} />
        ) : (
          <Col style={{ width: '100%', justifyContent: 'center', padding: 32 }}>
            <Txt style={{ ...label(15), marginBottom: 10 }}>No photo yet. Please go by this.</Txt>
            <Txt style={{ ...body(28, INK, 700), lineHeight: 1.2 }}>{data.description || data.lookFor}</Txt>
          </Col>
        )}
      </div>
      <Col style={{ width: 640, height: 630 }}>
        <Col style={{ backgroundColor: NAVY, padding: '30px 40px 24px' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Txt style={label(15, ON_NAVY)}>Please help · {data.lastSeenArea.split(',').pop().trim() || 'near you'}</Txt>
            {data.reward ? <Txt style={label(15, FLASH)}>Reward {data.reward === 'REWARD' ? 'offered' : data.reward}</Txt> : null}
          </Row>
          <Txt style={{ ...black(fit(data.headlineBig, 560, 96, 48), FLASH), marginTop: 6 }}>{data.headlineBig}</Txt>
        </Col>
        <Col style={{ padding: '22px 40px 0', flexGrow: 1 }}>
          <Txt style={label(15, SOFT)}>Have you seen</Txt>
          <Txt style={{ ...black(fit(name, 560, 72, 36)), marginTop: 2 }}>{name}</Txt>
          <Txt style={{ ...body(23), marginTop: 12 }}>{data.lookFor}</Txt>
          <Col style={{ marginTop: 14, backgroundColor: WASH, padding: '12px 16px', borderLeft: `8px solid ${FLASH}` }}>
            <Txt style={label(13, INK)}>Last seen {whereLine(data)}{data.lastSeenWhen ? `, ${data.lastSeenWhen}` : ''}</Txt>
            <Txt style={{ ...body(19, INK, 700), marginTop: 4 }}>{data.ifYouSee}</Txt>
          </Col>
        </Col>
        <Row style={{ backgroundColor: NAVY, padding: '22px 40px', justifyContent: 'space-between', alignItems: 'center' }}>
          <Col style={{ minWidth: 0 }}>
            <Txt style={label(14, ON_NAVY)}>{contactLabel(data)}</Txt>
            <Txt style={{ ...black(fit(data.contactValue, 420, 52, 26), PAPER), marginTop: 2 }}>{data.contactValue}</Txt>
          </Col>
          <Txt style={{ ...body(17, ON_NAVY, 700), flexShrink: 0 }}>reunitepets.org</Txt>
        </Row>
      </Col>
    </Row>
  );
}

export function SocialCard({ data, size, photoSrc }) {
  const src = photoSrc ?? data.photoDataUrl ?? null;
  if (size === 'story') return <Story data={data} src={src} />;
  if (size === 'square') return <Square data={data} src={src} />;
  return <Og data={data} src={src} />;
}
