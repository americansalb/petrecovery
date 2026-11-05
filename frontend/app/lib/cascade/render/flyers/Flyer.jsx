/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf, fitFraunces, FRAUNCES } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * second design" (design px × 0.75 = pt).
 *
 * A cover. The photo bleeds off the top and the sides of the sheet, cut
 * around the pet, with nothing on it: it is the evidence, and a word over
 * it would hide an ear or darken a coat. Under it, on warm paper, one
 * line: LOST in red and "Milo, a tabby cat" in the italic, both in
 * Fraunces, as large as the width allows. Then where and when, two lines
 * of what to look for, the phone number in the same face, the reward, the
 * QR code, and tear tabs. Paper, ink, one red.
 *
 * The layout comes from ./plan.js: every block under the photo has a set
 * height and the photo takes what is left. The photo arrives already cut
 * to that shape (index.js, render/photo.js) with the face set just above
 * the frame's middle.
 *
 *  - FLYER_LETTER: Letter, tear tabs at the foot.
 *  - FLYER_HALF: two half sheets on one Letter page, the photo in a column.
 *  - FLYER_POSTER: 11 × 17, the Letter sheet scaled, no tabs.
 */

const C = {
  paper: '#f7f4ee',
  ink: '#1c1917',
  muted: '#78716c',
  red: '#b91c1c',
  line: '#ddd6ca',
  dash: '#c4bbab',
  nophoto: '#e9e2d6',
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

const BODY = (fs, color = C.ink, weight = 500) => ({ fontFamily: 'Inter', fontWeight: weight, fontSize: fs, lineHeight: 1.4, color });
const EYEBROW = (fs, color = C.muted) => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: fs,
  letterSpacing: fs * 0.15,
  textTransform: 'uppercase',
  color,
});
const MONO = (fs, color = C.muted) => ({ fontFamily: 'Courier', fontSize: fs, color, lineHeight: 1.3 });

/**
 * One line of Fraunces that takes exactly its cap height on the sheet and
 * ends on its baseline: the line box is pulled up by the air above the
 * caps (FRAUNCES.top) and trimmed to the baseline, so a word sits tight on
 * what follows and two lines of different sizes share a baseline when
 * their row aligns them at the end. react-pdf drops a line that does not
 * fit a fixed-height box, so the box here is never fixed.
 */
function TightLine({ size, color = C.ink, italic = false, style = {}, children }) {
  const font = italic ? { fontFamily: 'Fraunces', fontWeight: 600, fontStyle: 'italic' } : { fontFamily: 'Fraunces', fontWeight: 900 };
  return (
    <View style={{ marginTop: -FRAUNCES.top * size, marginBottom: (FRAUNCES.top + FRAUNCES.cap - 1) * size, ...style }}>
      <Text maxLines={1} style={{ ...font, fontSize: size, lineHeight: 1, letterSpacing: italic ? -size * 0.01 : -size * 0.03, color }}>
        {children}
      </Text>
    </View>
  );
}

/** "$500 reward" or "Reward offered" */
const rewardLine = (data) => (data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`);

/** "Seen Milo? Call or text, any hour" */
function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (/EMAIL/i.test(data.contactVerb || '')) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

/* ------------------------------------------------------------- primitives */

/** The photo, filling its frame; without one, the description in its place. */
function Photo({ data, src, w, h, k }) {
  if (src) return <Image src={src} style={{ width: w, height: h, objectFit: 'cover' }} />;
  return (
    <View style={{ width: w, height: h, backgroundColor: C.nophoto, paddingHorizontal: 30 * k, justifyContent: 'center' }}>
      <Text style={{ ...EYEBROW(9 * k, C.muted), marginBottom: 10 * k }}>No photo yet. Please go by this.</Text>
      <Text style={{ fontFamily: 'Fraunces', fontWeight: 600, fontStyle: 'italic', fontSize: fitFraunces(data.description || data.lookFor, w * 2.4, 27 * k, 15 * k), lineHeight: 1.15, color: C.ink }}>
        {data.description || data.lookFor}
      </Text>
      <Text style={{ ...BODY(10.5 * k, C.muted), marginTop: 12 * k }}>A photo goes on the page at the link as soon as the family adds one. Scan the code to see it.</Text>
    </View>
  );
}

/** LOST in red and "Milo, a tabby cat" in the italic: one line, or two when the line is long. */
function WordLine({ data, word, w, gap }) {
  if (word.stacked) {
    return (
      <View style={{ width: w }}>
        <TightLine size={word.wordSize} color={data.accentDeep}>{data.stamp}</TightLine>
        <TightLine size={word.lineSize} italic style={{ marginTop: word.lineSize * 0.45 }}>{data.coverLine}</TightLine>
      </View>
    );
  }
  return (
    <View style={{ width: w, flexDirection: 'row', alignItems: 'flex-end' }}>
      <TightLine size={word.wordSize} color={data.accentDeep}>{data.stamp}</TightLine>
      <TightLine size={word.lineSize} italic style={{ marginLeft: gap, flexShrink: 1 }}>{data.coverLine}</TightLine>
    </View>
  );
}

/** Where and when, then two lines of what to look for. */
function Facts({ data, w, k, lines = 2, lastSeen = 15, facts = 36, gap = 4.5 }) {
  return (
    <View style={{ width: w }}>
      <Text maxLines={1} style={{ ...BODY(11.25 * k, C.muted, 400), height: lastSeen, lineHeight: 1.2 }}>
        <Text style={EYEBROW(8.25 * k, C.red)}>Last seen  </Text>
        <Text style={{ fontWeight: 600, color: C.ink }}>{data.lastSeenWhen}</Text>
        {data.lastSeenWhen ? '   ' : ''}
        {data.lastSeenArea}
      </Text>
      <Text maxLines={lines} style={{ ...BODY(12.75 * k), height: facts, marginTop: gap }}>
        {data.lookFor}
        {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
      </Text>
    </View>
  );
}

/** The rule, the eyebrow, the phone in the cover's face; the reward, the link and the QR code at the right. */
function Contact({ data, w, h, k, phoneBase = 52.5, qr = 60, urlW = 108, url = true }) {
  const qrW = data.qrDataUrl ? qr * k : 0;
  const rightW = (url ? urlW * k : 0) + (qrW ? qrW + 12 * k : 0);
  const phone = fitFraunces(data.contactValue, w - rightW - 12 * k, phoneBase * k, 14 * k);
  return (
    <View style={{ width: w, height: h, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 10.5 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ minWidth: 0 }}>
        <Text maxLines={1} style={{ ...EYEBROW(9 * k), marginBottom: 6 * k }}>{contactEyebrow(data)}</Text>
        <TightLine size={phone}>{data.contactValue}</TightLine>
        {!url && data.reward ? <Text style={{ ...EYEBROW(9 * k, C.red), marginTop: 8 * k }}>{rewardLine(data)}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {url ? (
          <View style={{ width: urlW * k, alignItems: 'flex-end' }}>
            {data.reward ? <Text style={EYEBROW(9 * k, C.red)}>{rewardLine(data)}</Text> : null}
            <Text style={{ ...MONO(7.5 * k), textAlign: 'right', marginTop: 3 * k }}>{`reunitepets.org/cases/\n${data.caseNumber}`}</Text>
          </View>
        ) : null}
        {qrW ? (
          <View style={{ width: qrW, alignItems: 'center', marginLeft: 12 * k }}>
            <Image src={data.qrDataUrl} style={{ width: qrW, height: qrW }} />
            <Text style={{ ...EYEBROW(5.5 * k, C.muted), letterSpacing: 0.3 * k, textAlign: 'center', marginTop: 3 * k, lineHeight: 1.2 }}>Scan to report a sighting</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Tear-off strip: 8 tabs, the phone (or the case number) and the name. */
function TearTabs({ data, w, h }) {
  const count = 8;
  const tabW = w / count;
  const first = data.hasPhone ? data.contactValue : data.caseNumber;
  const second = data.hasPhone ? `${data.petName} · ${data.stamp}` : 'reunitepets.org';
  return (
    <View style={{ width: w, flexDirection: 'row', height: h, borderTopWidth: 0.75, borderTopColor: C.dash, borderTopStyle: 'dashed' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: tabW, height: h, borderLeftWidth: i ? 0.75 : 0, borderLeftColor: C.dash, borderLeftStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: fitInter(first, tabW - 8, 7.5, 5), color: C.ink }}>{first}</Text>
          <Text style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: fitInter(second, tabW - 8, 6, 4.5), color: C.muted, marginTop: 2 }}>{second}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- layouts */

/** One sheet, planned by plan.js: Letter (with tabs) or the poster (scaled). */
function Sheet({ data, plan, photoSrc }) {
  const { k, page, side, contentW } = plan;
  return (
    <Page size={[page.w, page.h]} style={{ backgroundColor: C.paper, fontFamily: 'Inter', color: C.ink }}>
      <Photo data={data} src={photoSrc} w={page.w} h={plan.frame.h} k={k} />
      <View style={{ paddingHorizontal: side }}>
        <View style={{ marginTop: plan.panelTop }}>
          <WordLine data={data} word={plan.word} w={contentW} gap={12 * k} />
        </View>
        <View style={{ marginTop: plan.gapA }}>
          <Facts data={data} w={contentW} k={k} lastSeen={plan.lastSeen} facts={plan.facts} gap={plan.gapB} />
        </View>
        <View style={{ marginTop: plan.gapC }}>
          <Contact data={data} w={contentW} h={plan.contact} k={k} />
        </View>
        {plan.tabs > 0 ? (
          <View style={{ marginTop: plan.tabsGap }}>
            <TearTabs data={data} w={contentW} h={plan.tabs} />
          </View>
        ) : null}
      </View>
    </Page>
  );
}

/** One half sheet: the photo in a column, the cover's words beside it. */
function Half({ data, plan, photoSrc, cut }) {
  const k = 0.85;
  const { pad, photoW, detailsW } = plan;
  return (
    <View
      style={{
        height: plan.halfH,
        paddingHorizontal: pad,
        paddingTop: pad,
        paddingBottom: pad - (cut ? 1.5 : 0),
        flexDirection: 'row',
        borderBottomWidth: cut ? 0.75 : 0,
        borderBottomColor: C.dash,
        borderBottomStyle: 'dashed',
      }}
    >
      <Photo data={data} src={photoSrc} w={photoW} h={plan.frame.h} k={k} />
      <View style={{ width: detailsW, marginLeft: pad, height: plan.frame.h, paddingTop: 6 }}>
        <WordLine data={data} word={plan.word} w={detailsW} gap={9} />
        <View style={{ marginTop: 12 }}>
          <Facts data={data} w={detailsW} k={k} lines={3} lastSeen={13} facts={50} gap={4} />
        </View>
        <View style={{ flex: 1 }} />
        <Contact data={data} w={detailsW} h={76} k={k} phoneBase={34} qr={70} url={false} />
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
  const words = { stamp: data.stamp, coverLine: data.coverLine };
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
