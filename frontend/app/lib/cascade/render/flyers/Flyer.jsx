/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf, fitUnbounded, UNBOUNDED, STICKER } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * second design" (design px × 0.75 = pt).
 *
 * A sticker on a yellow sheet. The pet's photo, cut into a circle with a
 * cream ring and a hard navy shadow, as big as the sheet allows. Under
 * it, centred: LOST in Unbounded, a wide face; the name; where and when;
 * two lines of what to look for; and the phone number inside a navy pill,
 * the one thing to do. The reward is a cream tag on the sticker, the QR
 * code a cream tile beside the pill, the tear tabs a cream strip along
 * the foot. Yellow, navy, cream: the site's own colours.
 *
 * The layout comes from ./plan.js: every block under the sticker has a
 * set height and the sticker takes what is left. The photo arrives already
 * cut square around the pet (index.js, render/photo.js).
 *
 *  - FLYER_LETTER: Letter, tear tabs at the foot.
 *  - FLYER_HALF: two half sheets on one Letter page, the sticker beside the words.
 *  - FLYER_POSTER: 11 × 17, the Letter sheet scaled, no tabs.
 */

const C = {
  yellow: '#facc15',
  navy: '#0f172a',
  cream: '#fffbea',
  soft: '#3b3a2e',
  dash: '#0f172a',
};

/* ---------------------------------------------------------------- helpers */

/** Width estimate (ems) for Inter, padded so fitted lines never wrap. */
function interEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.3;
    else if ('mwMW@'.includes(ch)) em += 0.9;
    else if (ch === ' ') em += 0.27;
    else if (ch >= 'a' && ch <= 'z') em += 0.55;
    else if (ch >= 'A' && ch <= 'Z') em += 0.66;
    else if (ch >= '0' && ch <= '9') em += 0.6;
    else em += 0.58;
  }
  return em * 1.06;
}
const fitInter = (text, maxW, base, min) => Math.max(min, Math.min(base, maxW / (interEm(text) || 1)));

const BODY = (fs, color = C.navy, weight = 500) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: fs, lineHeight: 1.4, color });
const NAME = (fs, color = C.navy) => ({ fontFamily: 'Inter', fontWeight: 800, fontSize: fs, lineHeight: 1.1, letterSpacing: -fs * 0.02, color });
const EYEBROW = (fs, color = C.navy) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: fs,
  letterSpacing: fs * 0.14,
  textTransform: 'uppercase',
  color,
});

/**
 * One line of Unbounded that takes exactly its cap height on the sheet:
 * the line box is pulled up by the air above the caps and trimmed to the
 * baseline (UNBOUNDED in plan.js). react-pdf drops a line that does not
 * fit a fixed-height box, so the box here is never fixed.
 */
function TightLine({ size, color = C.navy, style = {}, children }) {
  return (
    <View style={{ marginTop: -UNBOUNDED.top * size, marginBottom: (UNBOUNDED.top + UNBOUNDED.cap - 1) * size, ...style }}>
      <Text maxLines={1} style={{ fontFamily: 'Unbounded', fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color }}>
        {children}
      </Text>
    </View>
  );
}

const rewardLine = (data) => (data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`);

function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

/* ------------------------------------------------------------- primitives */

/** The photo as a round sticker: a cream ring, a hard navy shadow, the reward as a tag. Without a photo, the description in the circle. */
function Sticker({ data, src, size, k, style = {} }) {
  const ring = Math.round(size * STICKER.ring);
  const off = Math.round(size * STICKER.shadow);
  const inner = size - ring * 2;
  return (
    <View style={{ position: 'relative', width: size + off, height: size + off, ...style }}>
      <View style={{ position: 'absolute', left: off, top: off, width: size, height: size, borderRadius: size / 2, backgroundColor: C.navy }} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <Image src={src} style={{ width: inner, height: inner, borderRadius: inner / 2, objectFit: 'cover' }} />
        ) : (
          <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: C.cream, paddingHorizontal: inner * 0.14, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...EYEBROW(7.5 * k, C.soft), textAlign: 'center', marginBottom: 8 * k }}>No photo yet. Please go by this.</Text>
            <Text style={{ ...NAME(fitInter(data.description || data.lookFor, inner * 2.2, 18 * k, 10 * k)), textAlign: 'center', lineHeight: 1.2 }}>{data.description || data.lookFor}</Text>
            <Text style={{ ...BODY(8.25 * k, C.soft), textAlign: 'center', marginTop: 8 * k }}>A photo goes on the page at the link as soon as the family adds one.</Text>
          </View>
        )}
      </View>
      {data.reward ? (
        <View
          style={{
            position: 'absolute',
            right: -3 * k,
            top: size * 0.08,
            backgroundColor: C.cream,
            borderWidth: 2.25 * k,
            borderColor: C.navy,
            borderRadius: 999,
            paddingVertical: 6 * k,
            paddingHorizontal: 13 * k,
          }}
        >
          <Text style={EYEBROW(Math.round(size * 0.034))}>{rewardLine(data)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The navy pill: the eyebrow in yellow, the phone in cream, centred. */
function Pill({ data, w, h, k, phoneBase = 34.5, align = 'center' }) {
  const padX = 24 * k;
  const phone = fitUnbounded(data.contactValue, w - padX * 2, phoneBase * k, 10 * k);
  return (
    <View style={{ width: w, height: h, backgroundColor: C.navy, borderRadius: h / 2, paddingHorizontal: padX, alignItems: align, justifyContent: 'center' }}>
      <Text maxLines={1} style={EYEBROW(9 * k, C.yellow)}>{contactEyebrow(data)}</Text>
      <View style={{ marginTop: 7 * k }}>
        <TightLine size={phone} color={C.cream}>{data.contactValue}</TightLine>
      </View>
      <View style={{ height: 5 * k }} />
    </View>
  );
}

/** The QR code in a cream tile. */
function QrTile({ data, size }) {
  if (!data.qrDataUrl) return null;
  const pad = Math.round(size * 0.09);
  return (
    <View style={{ width: size, height: size, backgroundColor: C.cream, borderRadius: size * 0.16, padding: pad }}>
      <Image src={data.qrDataUrl} style={{ width: size - pad * 2, height: size - pad * 2 }} />
    </View>
  );
}

/** "LAST SEEN  Wed, Nov 4  Sach'a Yuntas" on one line, centred or not. */
function LastSeen({ data, k, align = 'center', w }) {
  return (
    <Text maxLines={1} style={{ ...BODY(12 * k, C.soft, 400), textAlign: align, width: w, lineHeight: 1.2 }}>
      <Text style={EYEBROW(8.25 * k)}>Last seen  </Text>
      <Text style={{ fontWeight: 700, color: C.navy }}>{data.lastSeenWhen}</Text>
      {data.lastSeenWhen ? '   ' : ''}
      {data.lastSeenArea}
    </Text>
  );
}

function Facts({ data, k, w, lines = 2, align = 'center' }) {
  return (
    <Text maxLines={lines} style={{ ...BODY(12.75 * k), width: w, textAlign: align }}>
      {data.lookFor}
      {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
    </Text>
  );
}

/** Tear-off strip on cream: 8 tabs, the phone (or the case number) and the name. */
function TearTabs({ data, w, h }) {
  const count = 8;
  const tabW = w / count;
  const first = data.hasPhone ? data.contactValue : data.caseNumber;
  const second = data.hasPhone ? `${data.petName} · ${data.stamp}` : 'reunitepets.org';
  return (
    <View style={{ width: w, flexDirection: 'row', height: h, backgroundColor: C.cream, borderRadius: 9, borderTopWidth: 0.75, borderTopColor: C.dash, borderTopStyle: 'dashed' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: tabW, height: h, borderLeftWidth: i ? 0.75 : 0, borderLeftColor: C.dash, borderLeftStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: fitInter(first, tabW - 8, 7.5, 5), color: C.navy }}>{first}</Text>
          <Text style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: fitInter(second, tabW - 8, 6, 4.5), color: C.soft, marginTop: 2 }}>{second}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- layouts */

/** One sheet, planned by plan.js: Letter (with tabs) or the poster (scaled). */
function Sheet({ data, plan, photoSrc }) {
  const { k, page, side, contentW } = plan;
  const qr = data.qrDataUrl ? 63 * k : 0;
  const pillW = contentW - (qr ? qr + 12 * k : 0);
  return (
    <Page size={[page.w, page.h]} style={{ backgroundColor: C.yellow, fontFamily: 'Inter', color: C.navy, paddingTop: plan.top, paddingHorizontal: side }}>
      <View style={{ alignItems: 'center' }}>
        <Sticker data={data} src={photoSrc} size={plan.sticker} k={k} />
      </View>
      <View style={{ marginTop: plan.gap, alignItems: 'center' }}>
        <TightLine size={plan.wordSize}>{data.stamp}</TightLine>
      </View>
      <Text maxLines={1} style={{ ...NAME(fitInter(data.coverLine, contentW, 27 * k, 14 * k)), textAlign: 'center', marginTop: plan.nameGap, height: plan.name }}>{data.coverLine}</Text>
      <View style={{ marginTop: plan.lastSeenGap, height: plan.lastSeen }}>
        <LastSeen data={data} k={k} w={contentW} />
      </View>
      <View style={{ marginTop: plan.factsGap, height: plan.facts, alignItems: 'center' }}>
        <Facts data={data} k={k} w={contentW - 60 * k} />
      </View>
      <View style={{ marginTop: plan.pillGap, flexDirection: 'row', alignItems: 'center' }}>
        <Pill data={data} w={pillW} h={plan.pill} k={k} />
        {qr ? (
          <View style={{ marginLeft: 12 * k }}>
            <QrTile data={data} size={qr} />
          </View>
        ) : null}
      </View>
      {plan.tabs > 0 ? (
        <View style={{ position: 'absolute', left: side, right: side, bottom: plan.bottom }}>
          <TearTabs data={data} w={contentW} h={plan.tabs} />
        </View>
      ) : (
        <Text style={{ ...BODY(9 * k, C.soft, 600), textAlign: 'center', marginTop: 12 * k }}>{data.caseUrlLabel}</Text>
      )}
    </Page>
  );
}

/** One half sheet: the sticker beside the words. */
function Half({ data, plan, photoSrc, cut }) {
  const k = 0.8;
  const { pad, sticker, colX, detailsW } = plan;
  return (
    <View style={{ height: plan.halfH, position: 'relative', borderBottomWidth: cut ? 0.75 : 0, borderBottomColor: C.navy, borderBottomStyle: 'dashed' }}>
      <View style={{ position: 'absolute', left: pad, top: plan.stickerTop }}>
        <Sticker data={data} src={photoSrc} size={sticker} k={k} />
      </View>
      {data.qrDataUrl ? (
        <View style={{ position: 'absolute', left: pad + sticker * 0.72, top: plan.stickerTop + sticker * 0.74 }}>
          <QrTile data={data} size={54} />
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: colX, top: pad + 6, width: detailsW, height: plan.halfH - pad * 2 - 9 }}>
        <TightLine size={plan.wordSize}>{data.stamp}</TightLine>
        <Text maxLines={1} style={{ ...NAME(fitInter(data.coverLine, detailsW, 19.5, 12)), marginTop: 7 }}>{data.coverLine}</Text>
        <View style={{ marginTop: 7 }}>
          <LastSeen data={data} k={k} align="left" w={detailsW} />
        </View>
        <View style={{ marginTop: 4 }}>
          <Facts data={data} k={k} w={detailsW} lines={3} align="left" />
        </View>
        <View style={{ flex: 1 }} />
        <Pill data={data} w={detailsW} h={62} k={k} phoneBase={26} align="flex-start" />
        <Text style={{ ...BODY(7.5, C.soft, 600), marginTop: 6 }}>{data.caseUrlLabel}</Text>
      </View>
    </View>
  );
}

function HalfSheetPage({ data, plan, photoSrc }) {
  return (
    <Page size={[PAGES.LETTER.w, PAGES.LETTER.h]} style={{ backgroundColor: C.yellow, fontFamily: 'Inter', color: C.navy }}>
      <Half data={data} plan={plan} photoSrc={photoSrc} cut />
      <Half data={data} plan={plan} photoSrc={photoSrc} />
    </Page>
  );
}

export function planFor(variant, data) {
  const photo = data.photos?.[0] || null;
  const words = { stamp: data.stamp };
  if (variant === 'half') return planHalf(PAGES.LETTER, photo, words);
  if (variant === 'poster') return planSheet(PAGES.TABLOID, photo, { k: PAGES.TABLOID.w / PAGES.LETTER.w, tabs: false, ...words });
  return planSheet(PAGES.LETTER, photo, { k: 1, tabs: true, ...words });
}

/**
 * @param {{data:object, variant:'letter'|'half'|'poster', plan:object, photoSrc:string|null}} props
 */
export function FlyerDocument({ data, variant = 'letter', plan, photoSrc }) {
  const p = plan || planFor(variant, data);
  const src = photoSrc ?? data.photos?.[0]?.src ?? null;
  return (
    <Document title={`${data.headlineBig} ${data.petName} (${data.caseNumber})`} author="ReunitePets">
      {variant === 'half' ? <HalfSheetPage data={data} plan={p} photoSrc={src} /> : <Sheet data={data} plan={p} photoSrc={src} />}
    </Document>
  );
}
