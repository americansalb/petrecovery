import React from 'react';
import { Document, Page, View, Text, Image, Svg, Path, Circle } from '@react-pdf/renderer';
import { FLYER_THEME as T, PAGE } from './theme';

/**
 * Lost-pet flyers in a restrained "ink" poster language: white ground, two
 * inks (near-black + signal red), edge-to-edge display type, the full photo
 * at its true aspect, and a giant phone number. Red appears exactly twice
 * (LOST DOG, the reward); everything else is black and gray, so the flyer
 * reads at distance, looks designed rather than templated, and prints
 * perfectly on a home black-and-white printer.
 *
 * Three layouts, one normalized `data`:
 *  - classic : full Letter poster
 *  - tabs    : Letter with real, cuttable tear-off tabs
 *  - poster  : 11x17 pole/yard poster, readable from across a street
 */

/** Estimate a string's width in ems for Inter Black — per-character classes
 *  (an 'm' or '@' is ~3x an 'i'), padded 6% so we never clip or wrap. */
function estWidthEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if ("iljI1.,:;!|'".includes(ch)) em += 0.34;
    else if ('mwMW@'.includes(ch)) em += 1.0;
    else if (ch === ' ') em += 0.3;
    else if (ch >= 'a' && ch <= 'z') em += 0.6;
    else if (ch >= 'A' && ch <= 'Z') em += 0.76;
    else if (ch >= '0' && ch <= '9') em += 0.64;
    else em += 0.62;
  }
  return em * 1.06;
}

/** Largest font size (≤ base) at which `text` fits one line in maxWidth pt. */
function fitSize(text, maxWidth, base, min = 9) {
  const em = estWidthEm(text) || 1;
  return Math.max(min, Math.min(base, maxWidth / em));
}

/** Frame size that shows the WHOLE photo: the photo's own aspect, bounded by
 *  maxHeight and availWidth. Falls back to a full-width frame when unknown. */
function photoDims(data, maxHeight, availWidth) {
  const a = data.photoAspect;
  if (!a) return { w: availWidth, h: maxHeight };
  const h = Math.min(maxHeight, availWidth * a);
  return { w: Math.min(availWidth, h / a), h };
}

/** Simple paw mark (used only where there is no photo). */
function Paw({ size = 64, color = T.midnight }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="5.3" cy="8.6" r="2.1" fill={color} />
      <Circle cx="9.4" cy="5.4" r="2.3" fill={color} />
      <Circle cx="14.6" cy="5.4" r="2.3" fill={color} />
      <Circle cx="18.7" cy="8.6" r="2.1" fill={color} />
      <Path
        d="M12 9.2c-2.9 0-5.6 2.5-5.6 5.2 0 1.9 1.4 3 3.1 3 .9 0 1.6-.3 2.5-.3s1.6.3 2.5.3c1.7 0 3.1-1.1 3.1-3 0-2.7-2.7-5.2-5.6-5.2z"
        fill={color}
      />
    </Svg>
  );
}

/** LOST DOG set edge-to-edge in the accent ink — the 30-foot read. */
function Headline({ data, width, base }) {
  const label = `${data.stamp} ${data.speciesLabel}`;
  return (
    <Text
      style={{
        color: data.accent,
        fontWeight: 900,
        fontSize: fitSize(label, width, base, 24),
        letterSpacing: -1,
        lineHeight: 1,
      }}
    >
      {label}
    </Text>
  );
}

/** "$500 REWARD" directly under the headline — the second and last red. */
function RewardLine({ data, fontSize, marginTop = 6 }) {
  if (!data.reward) return null;
  const label = data.reward === 'REWARD' ? 'REWARD OFFERED' : `${data.reward} REWARD`;
  return (
    <Text style={{ color: data.accent, fontWeight: 900, fontSize, letterSpacing: 2, marginTop }}>{label}</Text>
  );
}

function Rule({ marginTop = 0, weight = 1.5, color = T.midnight }) {
  return <View style={{ height: weight, backgroundColor: color, marginTop }} />;
}

/** The pet, whole, at the photo's true aspect. Thin keyline, no effects. */
function PhotoBlock({ data, maxHeight, availWidth }) {
  const src = data.photos[0];
  if (!src) {
    return (
      <View
        style={{
          height: maxHeight,
          borderWidth: 1,
          borderColor: T.hair,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paw size={Math.max(52, maxHeight * 0.2)} color={T.faint} />
        <Text style={{ color: T.mute, fontWeight: 600, fontSize: Math.max(9, maxHeight * 0.036), marginTop: 10 }}>
          No photo yet. Please go by the description.
        </Text>
      </View>
    );
  }
  if (data.photoAspect) {
    const { w, h } = photoDims(data, maxHeight, availWidth);
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: w, height: h, borderWidth: 1, borderColor: T.hair }}>
          <Image src={src} style={{ width: w - 2, height: h - 2 }} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ height: maxHeight, borderWidth: 1, borderColor: T.hair }}>
      <Image
        src={src}
        style={{ width: '100%', height: maxHeight - 2, objectFit: 'cover', objectPositionY: '25%' }}
      />
    </View>
  );
}

/** Name + identity chips, poster-tight. */
function NameRow({ data, width, base = 46, center = false }) {
  const name = data.petName.toUpperCase();
  const chips = data.chips.join('  ·  ') + (data.microchipped ? `${data.chips.length ? '  ·  ' : ''}Microchipped` : '');
  return (
    <View style={{ alignItems: center ? 'center' : 'flex-start' }}>
      <Text
        style={{
          color: T.midnight,
          fontWeight: 900,
          fontSize: fitSize(name, width, base, 18),
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {name}
      </Text>
      {chips ? (
        <Text style={{ color: T.mute, fontWeight: 600, fontSize: Math.max(10, base * 0.24), marginTop: 5 }}>
          {chips}
        </Text>
      ) : null}
    </View>
  );
}

/** Quiet spec table: LOOK FOR / IF YOU SEE / LAST SEEN. Hairline rules only. */
function SpecTable({ data, compact = false }) {
  const rows = [
    data.markings ? { label: 'LOOK FOR', value: data.markings } : null,
    { label: `IF YOU SEE ${data.petName.toUpperCase()}`, value: data.approachLine },
    { label: 'LAST SEEN', value: [data.lastSeenArea, data.lastSeenWhen].filter(Boolean).join('  ·  ') },
  ].filter(Boolean);
  const labelW = compact ? 96 : 110;
  const fs = compact ? 8.5 : 10;
  return (
    <View style={{ marginTop: compact ? 8 : 12, borderTopWidth: 1, borderTopColor: T.hair }}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            paddingVertical: compact ? 4.5 : 6.5,
            borderBottomWidth: 1,
            borderBottomColor: T.hair,
          }}
        >
          <Text
            style={{
              width: labelW,
              fontSize: fs - 2,
              color: T.midnight,
              fontWeight: 900,
              letterSpacing: 0.8,
              marginTop: 1,
            }}
          >
            {r.label}
          </Text>
          <Text style={{ flex: 1, fontSize: fs, color: T.slate, fontWeight: 600, lineHeight: 1.4 }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Bottom contact block on the white ground: rule, giant black phone, QR. */
function ContactBlock({ data, width, phoneBase, qrSize }) {
  const qrBox = data.qrDataUrl ? qrSize + 2 : 0;
  const textW = width - (qrBox ? qrBox + 22 : 0);
  const isPhone = /^[\d\s()+\-.]+$/.test(data.contactValue || '');
  const valueBase = isPhone ? phoneBase : phoneBase * 0.66;
  return (
    <View>
      <Rule weight={2} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: phoneBase * 0.32 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.mute, fontWeight: 700, fontSize: Math.max(8.5, phoneBase * 0.22), letterSpacing: 2.5 }}>
            {data.contactVerb}
          </Text>
          <Text
            style={{
              color: T.midnight,
              fontWeight: 900,
              fontSize: fitSize(data.contactValue, textW, valueBase, 11),
              letterSpacing: -0.5,
              marginTop: 3,
            }}
          >
            {data.contactValue}
          </Text>
          {data.contactSecondary ? (
            <Text style={{ color: T.mute, fontSize: Math.max(8.5, phoneBase * 0.2), marginTop: 3 }}>
              {data.contactSecondary}
            </Text>
          ) : null}
          {data.contactValue !== data.caseUrlLabel ? (
            <Text style={{ color: T.faint, fontSize: Math.max(7.5, phoneBase * 0.16), marginTop: 6 }}>
              {data.caseUrlLabel}
            </Text>
          ) : null}
        </View>
        {data.qrDataUrl ? (
          <View style={{ alignItems: 'center', marginLeft: 22 }}>
            <View style={{ borderWidth: 1, borderColor: T.hair, padding: 1 }}>
              <Image src={data.qrDataUrl} style={{ width: qrSize, height: qrSize }} />
            </View>
            <Text
              style={{
                color: T.mute,
                fontSize: 7.5,
                fontWeight: 600,
                marginTop: 4,
                maxWidth: qrSize + 6,
                textAlign: 'center',
              }}
            >
              {data.scanCta}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Real tear-off tabs: rotated so the number runs up the tab, dashed cut lines. */
function TearTabs({ data, count = 10, height = 124 }) {
  const tabW = PAGE.LETTER.width / count;
  const inner = { w: height - 14, h: tabW - 8 };
  const tabText = data.contactValue;
  return (
    <View
      style={{
        flexDirection: 'row',
        height,
        borderTopWidth: 1.2,
        borderTopColor: T.faint,
        borderTopStyle: 'dashed',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: tabW,
            height,
            borderRightWidth: i < count - 1 ? 1.2 : 0,
            borderRightColor: T.faint,
            borderRightStyle: 'dashed',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (tabW - inner.w) / 2,
              top: (height - inner.h) / 2,
              width: inner.w,
              height: inner.h,
              transform: 'rotate(-90deg)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: T.midnight, fontWeight: 900, fontSize: fitSize(tabText, inner.w, 11.5, 6) }}>
              {tabText}
            </Text>
            <Text style={{ color: T.mute, fontWeight: 600, fontSize: 6.5, marginTop: 2, letterSpacing: 0.5 }}>
              {data.stamp} {data.speciesLabel} · {data.petName.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const M = 40; // letter margin
const MP = 56; // poster margin

function ClassicLetter({ data }) {
  const bodyW = PAGE.LETTER.width - M * 2;
  // Portrait photos get a side-by-side hero (tall photo, name beside it) so
  // showing the WHOLE pet doesn't shrink the photo to a stamp.
  const isPortrait = Boolean(data.photos[0]) && data.photoAspect > 1.05;
  const heroH = data.reward ? 316 : 336;
  const pw = isPortrait ? photoDims(data, heroH, bodyW * 0.46).w : 0;
  return (
    <Page size="LETTER" style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <View style={{ flexGrow: 1, paddingHorizontal: M, paddingTop: 34, paddingBottom: 30 }}>
        <Headline data={data} width={bodyW} base={94} />
        <RewardLine data={data} fontSize={17} marginTop={8} />
        <Rule marginTop={14} />
        <View style={{ marginTop: 18 }}>
          {isPortrait ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <PhotoBlock data={data} maxHeight={heroH} availWidth={bodyW * 0.46} />
              <View style={{ flex: 1, paddingLeft: 22 }}>
                <NameRow data={data} width={bodyW - pw - 22} base={44} />
                <Text style={{ color: T.slate, fontSize: 11, lineHeight: 1.5, marginTop: 9 }}>{data.plea}</Text>
              </View>
            </View>
          ) : (
            <>
              <PhotoBlock data={data} maxHeight={data.reward ? 236 : 250} availWidth={bodyW} />
              <View style={{ marginTop: 16 }}>
                <NameRow data={data} width={bodyW} base={44} />
              </View>
              <Text style={{ color: T.slate, fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>{data.plea}</Text>
            </>
          )}
        </View>
        <SpecTable data={data} />
        <View style={{ flexGrow: 1 }} />
        <ContactBlock data={data} width={bodyW} phoneBase={46} qrSize={86} />
      </View>
    </Page>
  );
}

function TearTabFlyer({ data }) {
  const bodyW = PAGE.LETTER.width - M * 2;
  // Tall bound for portraits, wide bound for landscapes: either way the whole
  // photo shows at real size beside the name column.
  const heroH = data.reward ? 284 : 300;
  const photoW = Math.max(photoDims(data, heroH, bodyW * 0.5).w, data.photos[0] ? 0 : bodyW * 0.5);
  return (
    <Page size="LETTER" style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <View style={{ flexGrow: 1, paddingHorizontal: M, paddingTop: 28, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Headline data={data} width={data.reward ? bodyW * 0.62 : bodyW} base={data.reward ? 44 : 52} />
          <RewardLine data={data} fontSize={15} marginTop={0} />
        </View>
        <Rule marginTop={10} />
        <View style={{ flexGrow: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <View style={{ width: photoW }}>
            <PhotoBlock data={data} maxHeight={heroH} availWidth={bodyW * 0.5} />
          </View>
          <View style={{ flex: 1, paddingLeft: 18, justifyContent: 'center' }}>
            <NameRow data={data} width={bodyW - photoW - 18} base={34} />
            <Text style={{ color: T.slate, fontSize: 10.5, lineHeight: 1.5, marginTop: 8 }}>{data.plea}</Text>
          </View>
        </View>
        <View style={{ flexGrow: 1 }} />
        <SpecTable data={data} compact />
        <View style={{ marginTop: 12 }}>
          <ContactBlock data={data} width={bodyW} phoneBase={32} qrSize={60} />
        </View>
      </View>
      <TearTabs data={data} />
    </Page>
  );
}

function YardPoster({ data }) {
  const W = PAGE.TABLOID.width;
  const bodyW = W - MP * 2;
  return (
    <Page size={[W, PAGE.TABLOID.height]} style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <View style={{ flexGrow: 1, paddingHorizontal: MP, paddingTop: 48, paddingBottom: 40 }}>
        <Headline data={data} width={bodyW} base={150} />
        <RewardLine data={data} fontSize={30} marginTop={12} />
        <Rule marginTop={20} weight={2.5} />
        <View style={{ marginTop: 26 }}>
          <PhotoBlock data={data} maxHeight={data.reward ? 490 : 540} availWidth={bodyW} />
        </View>
        <View style={{ marginTop: 26 }}>
          <NameRow data={data} width={bodyW} base={68} />
        </View>
        <Text style={{ color: T.slate, fontSize: 15, lineHeight: 1.45, marginTop: 12 }}>{data.plea}</Text>
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: T.hair, paddingTop: 12 }}>
          {data.markings ? (
            <Text style={{ color: T.midnight, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              <Text style={{ fontWeight: 900 }}>LOOK FOR:{'  '}</Text>
              {data.markings}
            </Text>
          ) : null}
          <Text style={{ color: T.midnight, fontWeight: 700, fontSize: 16 }}>
            <Text style={{ fontWeight: 900 }}>LAST SEEN:{'  '}</Text>
            {[data.lastSeenArea, data.lastSeenWhen].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        <View style={{ flexGrow: 1 }} />
        <ContactBlock data={data} width={bodyW} phoneBase={64} qrSize={130} />
      </View>
    </Page>
  );
}

const VARIANTS = { classic: ClassicLetter, tabs: TearTabFlyer, poster: YardPoster };

export function FlyerDocument({ data, variant = 'classic' }) {
  const Variant = VARIANTS[variant] || ClassicLetter;
  return (
    <Document title={`${data.stamp} ${data.petName} (${data.caseNumber})`} author="ReunitePets">
      <Variant data={data} />
    </Document>
  );
}
