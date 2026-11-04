import React from 'react';
import { Document, Font, Page, View, Text, Image, Svg, Circle } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers"
 * (design px × 0.75 = pt) with the ReunitePets tokens: navy #0f172a, flash
 * #facc15, lost red for the last-seen pin only.
 *
 * Read from the car: the photo, LOST DOG, the phone. From the sidewalk: the
 * name, what to look for, what to do, where and when, the QR code.
 *
 * The layout comes from ./plan.js (planSheet, planHalf): the photo frame
 * takes the room the fixed blocks leave and follows the photo's shape; the
 * photo arrives already cut to that shape (index.js, render/photo.js), so
 * objectFit cover here is only a safety net.
 *
 *  - FLYER_LETTER: Letter with tear tabs; wide photo across, tall photo in a column.
 *  - FLYER_HALF: two half sheets on one Letter page, for when every sheet counts.
 *  - FLYER_POSTER: 11 × 17, the Letter sheet scaled, no tabs.
 */

const C = {
  ink: '#0f172a',
  navy: '#0f172a',
  flash: '#facc15',
  wash: '#fefce8',
  cell: '#f1f5f9',
  line: '#e2e8f0',
  muted: '#64748b',
  soft: '#475569',
  onNavy: '#cbd5e1',
  lost: '#dc2626',
  paper: '#ffffff',
  dash: '#94a3b8',
  dashB: '#cbd5e1',
  mapGround: '#eef2f8',
};

/* ---------------------------------------------------------------- helpers */

/** Width estimate (ems) for Archivo Black; padded so fitted lines never wrap. */
function estWidthEm(text) {
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
  return em * 1.06;
}

function fitSize(text, maxWidth, base, min = 9) {
  const em = estWidthEm(text) || 1;
  return Math.max(min, Math.min(base, maxWidth / em));
}

const T = {
  urgent: 'PLEASE HELP · URGENT',
  reward: 'REWARD',
  seen: 'HAVE YOU SEEN',
  lookFor: 'LOOK FOR',
  ifYouSee: (n) => `IF YOU SEE ${n}`,
  lastSeen: 'LAST SEEN',
  call: 'CALL OR TEXT, ANY HOUR',
  email: 'EMAIL, ANY HOUR',
  report: 'REPORT A SIGHTING AT',
  scan: 'SCAN TO REPORT A SIGHTING',
  scanLong: 'SCAN TO REPORT A SIGHTING OR SEE UPDATES',
  noPhoto: 'NO PHOTO YET. PLEASE GO BY THIS.',
  noPhotoHint: 'A photo goes on the page at the link as soon as the family adds one. Scan the code to see it.',
  footer: 'Updates, more photos and the search map at the link.',
};

function contactLabel(data) {
  if (data.hasPhone) return T.call;
  if (/EMAIL/i.test(data.contactVerb || '')) return T.email;
  return T.report;
}

const label = (fs, color = C.muted) => ({
  fontFamily: 'Archivo',
  fontWeight: 800,
  fontSize: fs,
  letterSpacing: fs * 0.16,
  color,
});

const BLACK = (fs, color = C.ink) => ({ fontFamily: 'Archivo Black', fontSize: fs, lineHeight: 1, color });
const BODY = (fs, color = C.ink) => ({ fontFamily: 'Inter', fontWeight: 600, fontSize: fs, lineHeight: 1.35, color });

/* ------------------------------------------------------------- primitives */

/** The navy band: PLEASE HELP, LOST DOG in flash, the reward on the right. */
function Band({ data, k, h, padH, contentW, compact = false }) {
  const rewardW = data.reward ? (data.reward === 'REWARD' ? 150 : 110) * k : 0;
  const big = fitSize(data.headlineBig, contentW - rewardW - 18 * k, (compact ? 40.5 : 72) * k, 24 * k);
  return (
    <View
      style={{
        height: h,
        backgroundColor: C.navy,
        paddingHorizontal: padH,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: (compact ? 9 : 16.5) * k,
      }}
    >
      <View style={{ minWidth: 0 }}>
        <Text style={{ ...label((compact ? 8.25 : 9.75) * k, C.onNavy), marginBottom: 4.5 * k }}>{T.urgent}</Text>
        <Text style={BLACK(big, C.flash)}>{data.headlineBig}</Text>
      </View>
      {data.reward ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...label((compact ? 8.25 : 9.75) * k, C.onNavy), marginBottom: 3 * k }}>{T.reward}</Text>
          <Text style={BLACK((data.reward === 'REWARD' ? 24 : compact ? 22.5 : 39) * k, C.flash)}>
            {data.reward === 'REWARD' ? 'OFFERED' : data.reward}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The photo, filling its frame. Without one: the description, big. */
function PhotoFrame({ data, src, w, h, k, borderW = 3 }) {
  return (
    <View style={{ width: w, height: h, borderWidth: borderW * k, borderColor: C.ink, backgroundColor: C.cell, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {src ? (
          <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%' }} />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 * k, paddingVertical: 18 * k }}>
            <Text style={{ ...label(9.75 * k), marginBottom: 10 * k }}>{T.noPhoto}</Text>
            <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 22.5 * k, lineHeight: 1.2, color: C.ink }}>
              {data.description || data.lookFor || `A ${data.speciesLabel.toLowerCase()} named ${data.petName}.`}
            </Text>
            <Text style={{ ...BODY(12 * k, C.soft), marginTop: 10 * k }}>{T.noPhotoHint}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** The last-seen map: street tiles, a red halo and dot where the pet was lost. */
function MapBox({ data, w, h, k, borderW = 2.25 }) {
  const m = data.map;
  if (!m) {
    return (
      <View style={{ width: w, height: h, borderWidth: borderW * k, borderColor: C.ink, backgroundColor: C.mapGround, justifyContent: 'center', padding: 6 * k }}>
        <Text style={{ ...BODY(8.25 * k, C.soft), textAlign: 'center' }}>Map at the link</Text>
      </View>
    );
  }
  const ox = (w - m.width) / 2;
  const oy = (h - m.height) / 2;
  const px = ox + m.pin.x;
  const py = oy + m.pin.y;
  const haloR = Math.min(m.halo?.r || 25, Math.min(w, h) * 0.4);
  return (
    <View style={{ width: w, height: h, borderWidth: borderW * k, borderColor: C.ink, overflow: 'hidden', backgroundColor: C.mapGround }}>
      <View style={{ position: 'absolute', left: ox, top: oy, width: m.width, height: m.height }}>
        {m.tiles.map((t, i) => (
          <Image key={i} src={t.src} style={{ position: 'absolute', left: t.left, top: t.top, width: 128, height: 128 }} />
        ))}
      </View>
      <Svg style={{ position: 'absolute', left: px - haloR, top: py - haloR }} width={haloR * 2} height={haloR * 2} viewBox={`0 0 ${haloR * 2} ${haloR * 2}`}>
        <Circle cx={haloR} cy={haloR} r={haloR - 1.6} fill={C.lost} fillOpacity={0.22} stroke={C.lost} strokeWidth={2.2} />
      </Svg>
      <Svg style={{ position: 'absolute', left: px - 7, top: py - 7 }} width={14} height={14} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={5.2} fill={C.lost} stroke="#ffffff" strokeWidth={1.8} />
      </Svg>
      <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 3, paddingVertical: 1 }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 4.5, color: C.muted }}>{m.attribution}</Text>
      </View>
    </View>
  );
}

/** LAST SEEN, when, the place, then the map filling the rest. */
function LastSeen({ data, w, h, k, mapBorder = 2.25 }) {
  const head = 26 * k;
  return (
    <View style={{ width: w, height: h }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={label(8.25 * k)}>{T.lastSeen}</Text>
        <Text style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 9 * k, color: C.soft }}>{data.lastSeenWhen}</Text>
      </View>
      <Text maxLines={1} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10.5 * k, lineHeight: 1.25, color: C.ink, marginTop: 2 * k, marginBottom: 3 * k }}>
        {data.lastSeenArea}
      </Text>
      <MapBox data={data} w={w} h={h - head} k={k} borderW={mapBorder} />
    </View>
  );
}

/** The navy contact panel: the phone, huge. */
function ContactPanel({ data, w, h, k, phoneBase = 33, pad = 15 }) {
  const size = fitSize(data.contactValue, w - pad * 2 * k, phoneBase * k, 9 * k);
  const who = [data.ownerFirstName, data.contactSecondary].filter(Boolean).join(' · ');
  return (
    <View style={{ width: w, height: h, backgroundColor: C.navy, paddingHorizontal: pad * k, justifyContent: 'center' }}>
      <Text style={label(9 * k, C.onNavy)}>{contactLabel(data)}</Text>
      <Text style={{ ...BLACK(size, C.paper), marginTop: 4 * k }}>{data.contactValue}</Text>
      {who ? <Text maxLines={1} style={{ ...BODY(10.5 * k, C.onNavy), marginTop: 3 * k }}>{who}</Text> : null}
    </View>
  );
}

/** Bordered QR box with its caption. */
function QrBox({ data, w, h, k, qr, caption = T.scan, borderW = 2.25 }) {
  if (!data.qrDataUrl) return <View style={{ width: w, height: h }} />;
  return (
    <View style={{ width: w, height: h, borderWidth: borderW * k, borderColor: C.ink, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: 6 * k }}>
      <Image src={data.qrDataUrl} style={{ width: qr, height: qr }} />
      <Text style={{ ...label(7.5 * k, C.ink), letterSpacing: 0.6, textAlign: 'center', marginTop: 4 * k, lineHeight: 1.25 }}>{caption}</Text>
    </View>
  );
}

/** QR beside its caption, for the narrow spots. */
function QrRow({ data, w, h, k, qr, caption = T.scanLong, borderW = 2.25 }) {
  if (!data.qrDataUrl) return <View style={{ width: w, height: h }} />;
  return (
    <View style={{ width: w, height: h, borderWidth: borderW * k, borderColor: C.ink, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7.5 * k }}>
      <Image src={data.qrDataUrl} style={{ width: qr, height: qr }} />
      <Text style={{ ...label(7.5 * k, C.ink), letterSpacing: 0.6, lineHeight: 1.3, marginLeft: 7.5 * k, flex: 1 }}>{caption}</Text>
    </View>
  );
}

/** HAVE YOU SEEN + the name, the facts line on the right. */
function NameRow({ data, w, h, k }) {
  const name = data.petName.toUpperCase();
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ minWidth: 0, flexShrink: 1 }}>
        <Text style={label(10.5 * k, C.soft)}>{T.seen}</Text>
        <Text style={{ ...BLACK(fitSize(name, w * 0.6, 48 * k, 18 * k)), marginTop: 2 * k }}>{name}</Text>
      </View>
      {data.factsLine ? (
        <Text maxLines={2} style={{ ...BODY(12.75 * k), textAlign: 'right', maxWidth: w * 0.42, marginBottom: 2 * k }}>{data.factsLine}</Text>
      ) : null}
    </View>
  );
}

/** HAVE YOU SEEN + the name + the facts, stacked, for the column layout. */
function NameBlock({ data, w, h, k }) {
  const name = data.petName.toUpperCase();
  return (
    <View style={{ width: w, height: h }}>
      <Text style={label(10.5 * k, C.soft)}>{T.seen}</Text>
      <Text style={{ ...BLACK(fitSize(name, w, 48 * k, 18 * k)), marginTop: 2 * k }}>{name}</Text>
      {data.factsLine ? <Text maxLines={2} style={{ ...BODY(12 * k), marginTop: 5 * k }}>{data.factsLine}</Text> : null}
    </View>
  );
}

function LookFor({ data, k, style = {}, lines = 3 }) {
  if (!data.lookFor) return null;
  return (
    <View style={{ backgroundColor: C.cell, paddingVertical: 7.5 * k, paddingHorizontal: 10.5 * k, ...style }}>
      <Text style={label(8.25 * k)}>{T.lookFor}</Text>
      <Text maxLines={lines} style={{ ...BODY(11.25 * k), marginTop: 2 * k }}>{data.lookFor}</Text>
    </View>
  );
}

function IfYouSee({ data, k, style = {}, lines = 3 }) {
  return (
    <View style={{ backgroundColor: C.wash, borderLeftWidth: 4.5 * k, borderLeftColor: C.flash, paddingVertical: 7.5 * k, paddingHorizontal: 10.5 * k, ...style }}>
      <Text style={label(8.25 * k, C.ink)}>{T.ifYouSee(data.petName.toUpperCase())}</Text>
      <Text maxLines={lines} style={{ ...BODY(11.25 * k), marginTop: 2 * k }}>{data.ifYouSee}</Text>
    </View>
  );
}

function FactsRow({ data, w, h, k }) {
  return (
    <View style={{ width: w, height: h, flexDirection: 'row' }}>
      <LookFor data={data} k={k} style={{ flex: 1, height: h }} />
      <IfYouSee data={data} k={k} style={{ flex: 1, height: h, marginLeft: 7.5 * k }} />
    </View>
  );
}

function Footer({ data, w, h, k }) {
  return (
    <View style={{ width: w, height: h, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text maxLines={1} style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 9 * k, color: C.muted, width: w - 175 * k }}>{T.footer}</Text>
      <Text maxLines={1} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 9 * k, color: C.ink, width: 165 * k, textAlign: 'right' }}>{data.caseUrlLabel}</Text>
    </View>
  );
}

/** Tear-off strip: 8 tabs, the phone and the pet's name turned on their side. */
function TearTabs({ data, w, h }) {
  const count = 8;
  const tabW = w / count;
  const inner = { w: h - 10, h: tabW - 6 };
  const second = `${data.petName.toUpperCase()} · ${data.headlineBig}`;
  return (
    <View style={{ width: w, flexDirection: 'row', height: h, borderTopWidth: 1.5, borderTopColor: C.dash, borderTopStyle: 'dashed' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: tabW, height: h, borderLeftWidth: i ? 1.5 : 0, borderLeftColor: C.dashB, borderLeftStyle: 'dashed' }}>
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
            <Text style={{ fontFamily: 'Archivo', fontWeight: 800, fontSize: fitSize(data.contactValue, inner.w, 9, 6), color: C.ink }}>{data.contactValue}</Text>
            <Text style={{ fontFamily: 'Archivo', fontWeight: 600, fontSize: fitSize(second, inner.w, 7, 5), letterSpacing: 0.5, color: C.muted, marginTop: 1.5 }}>{second}</Text>
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
  const withTabs = plan.tabs > 0;
  return (
    <Page size={[page.w, page.h]} style={{ backgroundColor: C.paper, fontFamily: 'Inter', color: C.ink }}>
      <Band data={data} k={k} h={plan.band} padH={margin} contentW={contentW} />
      {plan.mode === 'column' ? (
        <View style={{ flexDirection: 'row', marginTop: plan.topGap, marginHorizontal: margin, height: plan.bodyH }}>
          <PhotoFrame data={data} src={photoSrc} w={plan.colW} h={plan.bodyH} k={k} />
          <View style={{ width: plan.detailsW, marginLeft: 12 * k, height: plan.bodyH }}>
            <NameBlock data={data} w={plan.detailsW} h={80 * k} k={k} />
            <LookFor data={data} k={k} style={{ marginTop: 7.5 * k, height: 82 * k }} lines={4} />
            <IfYouSee data={data} k={k} style={{ marginTop: 7.5 * k, height: 82 * k }} lines={4} />
            <View style={{ marginTop: 7.5 * k }}>
              <LastSeen data={data} w={plan.detailsW} h={plan.mapH + 26 * k} k={k} />
            </View>
            <View style={{ marginTop: 7.5 * k }}>
              <ContactPanel data={data} w={plan.detailsW} h={84 * k} k={k} phoneBase={27} pad={12} />
            </View>
            <View style={{ marginTop: 7.5 * k }}>
              <QrRow data={data} w={plan.detailsW} h={60 * k} k={k} qr={45 * k} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: plan.topGap, marginHorizontal: margin }}>
          <PhotoFrame data={data} src={photoSrc} w={contentW} h={plan.frame.h} k={k} />
          <View style={{ marginTop: plan.gap }}>
            <NameRow data={data} w={contentW} h={plan.name} k={k} />
          </View>
          <View style={{ marginTop: plan.gap }}>
            <FactsRow data={data} w={contentW} h={plan.facts} k={k} />
          </View>
          <View style={{ marginTop: plan.gap, flexDirection: 'row', height: plan.row }}>
            <LastSeen data={data} w={187.5 * k} h={plan.row} k={k} />
            <View style={{ marginLeft: 9 * k, flex: 1 }}>
              <ContactPanel data={data} w={contentW - (187.5 + 112.5 + 18) * k} h={plan.row} k={k} />
            </View>
            <View style={{ marginLeft: 9 * k }}>
              <QrBox data={data} w={112.5 * k} h={plan.row} k={k} qr={Math.min(75 * k, plan.row - 34 * k)} />
            </View>
          </View>
        </View>
      )}
      <View style={{ marginTop: plan.gap, marginHorizontal: margin }}>
        <Footer data={data} w={contentW} h={plan.footer} k={k} />
      </View>
      {withTabs ? (
        <View style={{ marginTop: plan.tabsGap, marginHorizontal: margin }}>
          <TearTabs data={data} w={contentW} h={plan.tabs} />
        </View>
      ) : null}
    </Page>
  );
}

/** One half sheet: photo column, then the band, the name, the facts, the phone. */
function Half({ data, plan, photoSrc, cut }) {
  const k = 1;
  const { pad, photoW, detailsW } = plan;
  return (
    <View
      style={{
        height: plan.halfH,
        paddingHorizontal: pad,
        paddingTop: pad,
        paddingBottom: pad - (cut ? 2 : 0),
        flexDirection: 'row',
        borderBottomWidth: cut ? 1.5 : 0,
        borderBottomColor: C.dash,
        borderBottomStyle: 'dashed',
      }}
    >
      <View style={{ width: photoW }}>
        <PhotoFrame data={data} src={photoSrc} w={photoW} h={plan.frame.h} k={k} />
        <View style={{ marginTop: 7.5 }}>
          <QrRow data={data} w={photoW} h={63} k={k} qr={49.5} />
        </View>
      </View>
      <View style={{ width: detailsW, marginLeft: 12 }}>
        <Band data={data} k={k} h={69} padH={13.5} contentW={detailsW - 27} compact />
        <View style={{ marginTop: 7.5 }}>
          <NameRow data={data} w={detailsW} h={46} k={0.78} />
        </View>
        <LookFor data={data} k={0.9} style={{ marginTop: 7.5 }} />
        <IfYouSee data={data} k={0.9} style={{ marginTop: 7.5 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 7.5 }}>
          <Text maxLines={1} style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 9.75, color: C.ink, width: detailsW - 96 }}>
            <Text style={label(7.5)}>{T.lastSeen}  </Text>
            {data.lastSeenArea}
          </Text>
          <Text maxLines={1} style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 9, color: C.soft, width: 90, textAlign: 'right' }}>{data.lastSeenWhen}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <ContactPanel data={data} w={detailsW} h={66} k={k} phoneBase={27} pad={12} />
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
