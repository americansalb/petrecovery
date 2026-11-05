/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * second design" (design px × 0.75 = pt).
 *
 * White paper. The photo, as large as the sheet allows, across the full
 * width. LOST in red and the species in black, in Bricolage Grotesque,
 * big enough to read from a car. Then the name, what to look for, where
 * and when, the one phone number (or the email, or the link), and a QR
 * code to the case page. Red is the only colour and it means lost, so a
 * home printer in grayscale loses nothing. No bands, no boxes, no map:
 * the map is one scan away.
 *
 * The layout comes from ./plan.js: the photo frame takes the room the
 * fixed blocks leave; the photo arrives already cut to that shape around
 * the pet (index.js, render/photo.js), so objectFit cover is a safety net.
 *
 *  - FLYER_LETTER: Letter, the photo across, tear tabs at the foot.
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

/** Width estimate (ems) for Bricolage Grotesque ExtraBold; padded so fitted lines never wrap. */
function estWidthEm(text) {
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
  return em * 1.06;
}

function fitSize(text, maxWidth, base, min = 9) {
  const em = estWidthEm(text) || 1;
  return Math.max(min, Math.min(base, maxWidth / em));
}

const DISPLAY = (fs, color = C.ink, weight = 800) => ({
  fontFamily: 'Bricolage Grotesque',
  fontWeight: weight,
  fontSize: fs,
  lineHeight: 1,
  letterSpacing: -fs * 0.03,
  color,
});
const BODY = (fs, color = C.ink, weight = 600) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: fs, lineHeight: 1.35, color });
const EYEBROW = (fs, color = C.muted) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: fs,
  letterSpacing: fs * 0.16,
  textTransform: 'uppercase',
  color,
});
const MONO = (fs, color = C.soft) => ({ fontFamily: 'Courier', fontSize: fs, color, lineHeight: 1.3 });

/** "Seen Max? Call or text any hour" */
function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email any hour`;
  return `${who} Report it at`;
}

/* ------------------------------------------------------------- primitives */

/** "Please help us find" over LOST DOG, LOST in red. */
function Head({ data, w, h, k, site = true }) {
  const eyebrow = 9 * k;
  const siteW = site ? 90 * k : 0;
  const big = fitSize(data.headlineBig, w - siteW - 8 * k, 93 * k, 40 * k);
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ minWidth: 0 }}>
        <Text style={{ ...EYEBROW(eyebrow), marginBottom: 5 * k }}>Please help us find</Text>
        <Text style={{ ...DISPLAY(big), letterSpacing: -big * 0.045, lineHeight: 0.9 }}>
          <Text style={{ color: data.accent }}>{data.stamp}</Text>
          {` ${data.speciesLabel}`}
        </Text>
      </View>
      {site ? <Text style={{ ...BODY(9.75 * k, C.muted, 600), marginBottom: 8 * k }}>reunitepets.org</Text> : null}
    </View>
  );
}

/** The photo, filling its frame; without one, the description in its place. */
function PhotoFrame({ data, src, w, h, k }) {
  const r = 9 * k;
  if (src) {
    return <Image src={src} style={{ width: w, height: h, objectFit: 'cover', borderRadius: r }} />;
  }
  return (
    <View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.cell, padding: 24 * k, justifyContent: 'center' }}>
      <Text style={{ ...EYEBROW(9 * k, C.soft), marginBottom: 10 * k }}>No photo yet. Please go by this.</Text>
      <Text style={{ ...DISPLAY(Math.min(30 * k, fitSize(data.description || data.lookFor, w * 2.6, 30 * k, 16 * k)), C.ink), lineHeight: 1.15, letterSpacing: -0.3 }}>
        {data.description || data.lookFor}
      </Text>
      <Text style={{ ...BODY(10.5 * k, C.soft), marginTop: 12 * k }}>A photo goes on the page at the link as soon as the family adds one. Scan the code to see it.</Text>
    </View>
  );
}

/** The name, what to look for, where and when; the QR code on the right. */
function Info({ data, w, h, k, qr = 84 }) {
  const qrW = data.qrDataUrl ? qr * k : 0;
  const textW = w - (qrW ? qrW + 24 * k : 0);
  const name = fitSize(data.petName, textW, 39 * k, 20 * k);
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ width: textW }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text maxLines={1} style={DISPLAY(name)}>{data.petName}</Text>
          {data.reward ? (
            <Text style={{ ...EYEBROW(9 * k, data.accent), marginLeft: 10 * k }}>{data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`}</Text>
          ) : null}
        </View>
        <Text maxLines={2} style={{ ...BODY(14.25 * k), lineHeight: 1.3, marginTop: 6 * k }}>
          {data.lookFor}
          {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
        </Text>
        <Text maxLines={1} style={{ ...BODY(11.25 * k, C.soft, 400), marginTop: 6 * k }}>
          <Text style={{ ...EYEBROW(9 * k, data.accent) }}>Last seen  </Text>
          <Text style={{ fontWeight: 600, color: C.ink }}>{data.lastSeenWhen}</Text>
          {data.lastSeenWhen ? '   ' : ''}
          {data.lastSeenArea}
        </Text>
      </View>
      {qrW ? (
        <View style={{ width: qrW + 4 * k, alignItems: 'center' }}>
          <Image src={data.qrDataUrl} style={{ width: qrW, height: qrW }} />
          <Text style={{ ...EYEBROW(7.5 * k, C.soft), letterSpacing: 0.6 * k, textAlign: 'center', marginTop: 5 * k, lineHeight: 1.25 }}>Scan to report a sighting</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The rule, the eyebrow, the phone as big as the line allows, the case link. */
function Contact({ data, w, h, k, urlW = 120, valueBase = 33 }) {
  const value = fitSize(data.contactValue, w - urlW * k - 12 * k, valueBase * k, 12 * k);
  return (
    <View style={{ width: w, height: h, borderTopWidth: 1.5 * k, borderTopColor: C.ink, paddingTop: 11 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ minWidth: 0 }}>
        <Text maxLines={1} style={{ ...EYEBROW(9 * k, data.accent), marginBottom: 4 * k }}>{contactEyebrow(data)}</Text>
        <Text maxLines={1} style={DISPLAY(value)}>{data.contactValue}</Text>
      </View>
      {urlW > 0 && (data.hasPhone || /EMAIL/i.test(data.contactVerb || '')) ? (
        <Text style={{ ...MONO(8.25 * k), textAlign: 'right', width: urlW * k }}>{`reunitepets.org/cases/\n${data.caseNumber}`}</Text>
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
            <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: fitSize(first, inner.w, 8.5, 6), color: C.ink }}>{first}</Text>
            <Text style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: fitSize(second, inner.w, 7, 5), color: C.soft, marginTop: 2 }}>{second}</Text>
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
      <Head data={data} w={contentW} h={plan.head} k={k} />
      <View style={{ marginTop: plan.gap }}>
        <PhotoFrame data={data} src={photoSrc} w={contentW} h={plan.frame.h} k={k} />
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

/** One half sheet: the photo in a column, the words beside it. */
function Half({ data, plan, photoSrc, cut }) {
  const k = 0.8;
  const { pad, photoW, detailsW } = plan;
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
      <PhotoFrame data={data} src={photoSrc} w={photoW} h={plan.frame.h} k={k} />
      <View style={{ width: detailsW, marginLeft: pad, height: plan.frame.h }}>
        <Head data={data} w={detailsW} h={66} k={0.62} site={false} />
        <View style={{ marginTop: 14 }}>
          <Info data={data} w={detailsW} h={96} k={0.78} qr={0} />
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ width: data.qrDataUrl ? detailsW - 80 : detailsW }}>
            <Contact data={data} w={data.qrDataUrl ? detailsW - 80 : detailsW} h={58} k={0.78} urlW={0} valueBase={26} />
            <Text style={{ ...MONO(7.5), marginTop: 4 }}>{`reunitepets.org/cases/\n${data.caseNumber}`}</Text>
          </View>
          {data.qrDataUrl ? (
            <View style={{ width: 63, alignItems: 'center' }}>
              <Image src={data.qrDataUrl} style={{ width: 60, height: 60 }} />
              <Text style={{ ...EYEBROW(6, C.soft), letterSpacing: 0.4, textAlign: 'center', marginTop: 4, lineHeight: 1.25 }}>Scan to report a sighting</Text>
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
  if (variant === 'half') return planHalf(PAGES.LETTER, photo);
  if (variant === 'poster') return planSheet(PAGES.TABLOID, photo, { k: PAGES.TABLOID.w / PAGES.LETTER.w, tabs: false });
  return planSheet(PAGES.LETTER, photo, { k: 1, tabs: true });
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
