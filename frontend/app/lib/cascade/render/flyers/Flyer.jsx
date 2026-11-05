/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf, fitAnton, ANTON_CAP, ANTON_TOP } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * second design" (design px × 0.75 = pt).
 *
 * Three things, each enormous: the word, the face, the phone. LOST DOG in
 * Anton, a poster face, across the full width of the sheet, LOST in red.
 * The photo square-cornered and as tall as the sheet allows, cut around
 * the pet, with a red reward disc over its corner when there is one. The
 * phone number in the same face. Then, small: the name, two lines of what
 * to look for, where and when, a QR code, tear tabs. White paper, black
 * type, one red; a home printer in grayscale loses nothing.
 *
 * The layout comes from ./plan.js: the word is set as large as the width
 * allows and the photo takes what the fixed blocks leave. The photo
 * arrives already cut to that shape (index.js, render/photo.js).
 *
 *  - FLYER_LETTER: Letter, tear tabs at the foot.
 *  - FLYER_HALF: two half sheets on one Letter page, the photo in a column.
 *  - FLYER_POSTER: 11 × 17, the Letter sheet scaled, no tabs.
 */

const C = {
  ink: '#0f172a',
  soft: '#475569',
  muted: '#64748b',
  lost: '#dc2626',
  paper: '#ffffff',
  cell: '#f1f5f9',
  dash: '#94a3b8',
};

/* ---------------------------------------------------------------- helpers */

/** Width estimate (ems) for Inter ExtraBold, padded so fitted lines never wrap. */
function interEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.32;
    else if ('mwMW@'.includes(ch)) em += 0.95;
    else if (ch === ' ') em += 0.28;
    else if (ch >= 'a' && ch <= 'z') em += 0.58;
    else if (ch >= 'A' && ch <= 'Z') em += 0.7;
    else if (ch >= '0' && ch <= '9') em += 0.62;
    else em += 0.6;
  }
  return em * 1.06;
}
const fitInter = (text, maxW, base, min) => Math.max(min, Math.min(base, maxW / (interEm(text) || 1)));

const ANTON = (fs, color = C.ink) => ({ fontFamily: 'Anton', fontSize: fs, lineHeight: 1, letterSpacing: -fs * 0.01, color });

/**
 * One line of Anton that takes exactly its cap height on the sheet: the
 * line box is pulled up by the air above the caps and padded below to the
 * baseline (ANTON_TOP, ANTON_CAP in plan.js), so a word sits tight on what
 * follows and a number sits on its rule. react-pdf drops a line that does
 * not fit a fixed-height box, so the box here is never fixed.
 */
function AntonLine({ size, color = C.ink, style = {}, children }) {
  return (
    <View style={{ marginTop: -ANTON_TOP * size, marginBottom: (ANTON_TOP + ANTON_CAP - 1) * size, ...style }}>
      <Text maxLines={1} style={ANTON(size, color)}>{children}</Text>
    </View>
  );
}
const NAME = (fs, color = C.ink) => ({ fontFamily: 'Inter', fontWeight: 900, fontSize: fs, lineHeight: 1, letterSpacing: -fs * 0.03, color });
const BODY = (fs, color = C.ink, weight = 600) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: fs, lineHeight: 1.3, color });
const EYEBROW = (fs, color = C.muted) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: fs,
  letterSpacing: fs * 0.14,
  textTransform: 'uppercase',
  color,
});
const MONO = (fs, color = C.soft) => ({ fontFamily: 'Courier', fontSize: fs, color, lineHeight: 1.3 });

/** "Seen Milo? Call or text, any hour" */
function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

/* ------------------------------------------------------------- primitives */

/** LOST DOG across the full width, LOST in red. */
function Word({ data, w, size }) {
  return (
    <AntonLine size={size} style={{ width: w }}>
      <Text style={{ color: data.accent }}>{data.stamp}</Text>
      {` ${data.speciesLabel}`}
    </AntonLine>
  );
}

/** The red disc over the photo's corner: "$500 / REWARD", or "REWARD / OFFERED". */
function RewardDisc({ data, size, k }) {
  const amount = data.reward !== 'REWARD';
  const big = amount ? data.reward : 'REWARD';
  const small = amount ? 'Reward' : 'Offered';
  const bigSize = fitAnton(big, size * 0.78, size * 0.36, size * 0.2);
  return (
    <View
      style={{
        position: 'absolute',
        top: -12 * k,
        right: -12 * k,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: data.accent,
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-8deg)',
      }}
    >
      <AntonLine size={bigSize} color={C.paper}>{big}</AntonLine>
      <Text style={{ ...EYEBROW(size * 0.085, C.paper), marginTop: size * 0.06 }}>{small}</Text>
    </View>
  );
}

/** The photo, filling its frame, square-cornered; without one, the description in its place. */
function PhotoBlock({ data, src, w, h, k, disc = 96 }) {
  return (
    <View style={{ position: 'relative', width: w, height: h }}>
      {src ? (
        <Image src={src} style={{ width: w, height: h, objectFit: 'cover' }} />
      ) : (
        <View style={{ width: w, height: h, backgroundColor: C.cell, padding: 24 * k, justifyContent: 'center' }}>
          <Text style={{ ...EYEBROW(9 * k, C.soft), marginBottom: 10 * k }}>No photo yet. Please go by this.</Text>
          <Text style={{ ...NAME(Math.min(30 * k, fitInter(data.description || data.lookFor, w * 2.6, 30 * k, 16 * k))), lineHeight: 1.15 }}>
            {data.description || data.lookFor}
          </Text>
          <Text style={{ ...BODY(10.5 * k, C.soft), marginTop: 12 * k }}>A photo goes on the page at the link as soon as the family adds one. Scan the code to see it.</Text>
        </View>
      )}
      {data.reward ? <RewardDisc data={data} size={disc * k} k={k} /> : null}
    </View>
  );
}

/** The name, what to look for, where and when; the QR code on the right. */
function Info({ data, w, h, k, qr = 56 }) {
  const qrW = data.qrDataUrl ? qr * k : 0;
  const textW = w - (qrW ? qrW + 18 * k : 0);
  const name = fitInter(data.petName, textW, 30 * k, 16 * k);
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ width: textW }}>
        <Text maxLines={1} style={NAME(name)}>{data.petName}</Text>
        <Text maxLines={2} style={{ ...BODY(12 * k), marginTop: 6 * k }}>
          {data.lookFor}
          {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
        </Text>
        <Text maxLines={1} style={{ ...BODY(9.75 * k, C.soft, 400), marginTop: 4.5 * k }}>
          <Text style={EYEBROW(8.25 * k, data.accent)}>Last seen  </Text>
          <Text style={{ fontWeight: 700, color: C.ink }}>{data.lastSeenWhen}</Text>
          {data.lastSeenWhen ? '   ' : ''}
          {data.lastSeenArea}
        </Text>
      </View>
      {qrW ? (
        <View style={{ width: qrW + 6 * k, alignItems: 'center' }}>
          <Image src={data.qrDataUrl} style={{ width: qrW, height: qrW }} />
          <Text style={{ ...EYEBROW(6.4 * k, C.soft), letterSpacing: 0.4 * k, textAlign: 'center', marginTop: 3 * k, lineHeight: 1.2 }}>Scan to report a sighting</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The rule, the eyebrow, the phone in the poster face, the case link. */
function Contact({ data, w, h, k, urlW = 120, valueBase = 51 }) {
  const value = fitAnton(data.contactValue, w - urlW * k - 12 * k, valueBase * k, 14 * k);
  return (
    <View style={{ width: w, height: h, borderTopWidth: 2.25 * k, borderTopColor: C.ink, paddingTop: 7.5 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ minWidth: 0 }}>
        <Text maxLines={1} style={{ ...EYEBROW(9 * k, data.accent), marginBottom: 3 * k }}>{contactEyebrow(data)}</Text>
        <AntonLine size={value}>{data.contactValue}</AntonLine>
      </View>
      {urlW > 0 && (data.hasPhone || /EMAIL/i.test(data.contactVerb || '')) ? (
        <Text style={{ ...MONO(8.25 * k), textAlign: 'right', width: urlW * k, marginBottom: 4 * k }}>{`reunitepets.org/cases/\n${data.caseNumber}`}</Text>
      ) : null}
    </View>
  );
}

/** Tear-off strip: 8 tabs, the phone (or the case number) turned on their side. */
function TearTabs({ data, w, h }) {
  const count = 8;
  const tabW = w / count;
  const inner = { w: h - 10, h: tabW - 6 };
  const first = data.hasPhone ? data.contactValue : data.caseNumber;
  const second = data.hasPhone ? `${data.headlineBig} · ${data.petName}` : 'reunitepets.org';
  return (
    <View style={{ width: w, flexDirection: 'row', height: h, borderTopWidth: 1.5, borderTopColor: C.dash, borderTopStyle: 'dashed' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: tabW, height: h, borderLeftWidth: i ? 1.5 : 0, borderLeftColor: C.dash, borderLeftStyle: 'dashed' }}>
          <View
            style={{
              position: 'absolute',
              left: (tabW - inner.w) / 2,
              top: (h - inner.h) / 2,
              width: inner.w,
              height: inner.h,
              transform: 'rotate(-90deg)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: fitInter(first, inner.w, 8.5, 6), color: C.ink }}>{first}</Text>
            <Text style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: fitInter(second, inner.w, 7, 5), color: C.soft, marginTop: 2 }}>{second}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- layouts */

/** One sheet, planned by plan.js: Letter (with tabs) or the poster (scaled). */
function Sheet({ data, plan, photoSrc }) {
  const { k, page, margin, contentW } = plan;
  return (
    <Page size={[page.w, page.h]} style={{ backgroundColor: C.paper, fontFamily: 'Inter', color: C.ink, paddingTop: margin, paddingHorizontal: margin }}>
      <Word data={data} w={contentW} size={plan.headSize} />
      <View style={{ marginTop: plan.gap }}>
        <PhotoBlock data={data} src={photoSrc} w={contentW} h={plan.frame.h} k={k} />
      </View>
      <View style={{ marginTop: plan.gap }}>
        <Info data={data} w={contentW} h={plan.info} k={k} />
      </View>
      <View style={{ marginTop: plan.contactGap }}>
        <Contact data={data} w={contentW} h={plan.contact} k={k} />
      </View>
      {plan.tabs > 0 ? (
        <View style={{ marginTop: plan.tabsGap }}>
          <TearTabs data={data} w={contentW} h={plan.tabs} />
        </View>
      ) : null}
    </Page>
  );
}

/** One half sheet: the photo in a column, LOST over CAT beside it, then the words. */
function Half({ data, plan, photoSrc, cut }) {
  const k = 0.75;
  const { pad, photoW, detailsW } = plan;
  const word = fitAnton(Math.max(data.stamp.length, data.speciesLabel.length) > 5 ? data.speciesLabel : data.stamp, detailsW, 112, 48);
  const qrW = data.qrDataUrl ? 54 : 0;
  return (
    <View
      style={{
        height: plan.halfH,
        paddingHorizontal: pad,
        paddingTop: pad,
        paddingBottom: pad - (cut ? 1.5 : 0),
        flexDirection: 'row',
        borderBottomWidth: cut ? 1.5 : 0,
        borderBottomColor: C.dash,
        borderBottomStyle: 'dashed',
      }}
    >
      <PhotoBlock data={data} src={photoSrc} w={photoW} h={plan.frame.h} k={k} disc={96} />
      <View style={{ width: detailsW, marginLeft: pad, height: plan.frame.h }}>
        <AntonLine size={word} color={data.accent}>{data.stamp}</AntonLine>
        <AntonLine size={word} style={{ marginTop: -ANTON_TOP * word + 4 }}>{data.speciesLabel}</AntonLine>
        <View style={{ marginTop: 9 }}>
          <Info data={data} w={detailsW} h={66} k={k} qr={0} />
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ width: detailsW - (qrW ? qrW + 12 : 0) }}>
            <Contact data={data} w={detailsW - (qrW ? qrW + 12 : 0)} h={54} k={k} urlW={0} valueBase={44} />
            <Text style={{ ...MONO(7.5), marginTop: 3 }}>{data.caseUrlLabel}</Text>
          </View>
          {qrW ? (
            <View style={{ width: qrW + 3, alignItems: 'center' }}>
              <Image src={data.qrDataUrl} style={{ width: qrW, height: qrW }} />
              <Text style={{ ...EYEBROW(6, C.soft), letterSpacing: 0.4, textAlign: 'center', marginTop: 3, lineHeight: 1.25 }}>Scan to report a sighting</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function HalfSheetPage({ data, plan, photoSrc }) {
  return (
    <Page size={[PAGES.LETTER.w, PAGES.LETTER.h]} style={{ backgroundColor: C.paper, fontFamily: 'Inter', color: C.ink }}>
      <Half data={data} plan={plan} photoSrc={photoSrc} cut />
      <Half data={data} plan={plan} photoSrc={photoSrc} />
    </Page>
  );
}

export function planFor(variant, data) {
  const photo = data.photos?.[0] || null;
  const headline = data.headlineBig;
  if (variant === 'half') return planHalf(PAGES.LETTER, photo);
  if (variant === 'poster') return planSheet(PAGES.TABLOID, photo, { k: PAGES.TABLOID.w / PAGES.LETTER.w, tabs: false, headline });
  return planSheet(PAGES.LETTER, photo, { k: 1, tabs: true, headline });
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
