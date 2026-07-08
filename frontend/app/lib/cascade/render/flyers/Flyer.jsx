import React from 'react';
import { Document, Page, View, Text, Image, Svg, Path, Circle } from '@react-pdf/renderer';
import { FLYER_THEME as T, PAGE } from './theme';

/**
 * Lost-pet flyers in a bold, editorial poster language: full-bleed color
 * bands, one huge instant read ("LOST DOG"), the photo treated with respect
 * (large, no text over it), a quiet spec table, and a high-contrast contact
 * band with an auto-fitting phone/email so nothing ever overflows. Three
 * layouts, one normalized `data`:
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

/** Simple paw mark (used only where there is no photo). */
function Paw({ size = 64, color = '#ffffff' }) {
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

/** Full-bleed banner: the one thing readable from across the street. */
function HeaderBand({ data, height, pad }) {
  const label = `${data.stamp} ${data.speciesLabel}`;
  const size = fitSize(label, PAGE_W(data) - pad * 2 - label.length * 4, height * 0.62, 24);
  return (
    <View style={{ backgroundColor: data.accentBg, height, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: size, letterSpacing: 4 }}>{label}</Text>
    </View>
  );
}

/** Slim full-bleed reward strip under the banner (classic missing-poster move). */
function RewardStrip({ data, height, fontSize }) {
  if (!data.reward) return null;
  const label = data.reward === 'REWARD' ? 'REWARD OFFERED' : `${data.reward} REWARD`;
  return (
    <View style={{ backgroundColor: T.flash, height, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: T.midnight, fontWeight: 900, fontSize, letterSpacing: 2.5 }}>{label}</Text>
    </View>
  );
}

/** Frame size that shows the WHOLE photo: the photo's own aspect, bounded by
 *  maxHeight and availWidth. Falls back to a full-width frame when unknown. */
function photoDims(data, maxHeight, availWidth) {
  const a = data.photoAspect;
  if (!a) return { w: availWidth, h: maxHeight };
  const h = Math.min(maxHeight, availWidth * a);
  return { w: Math.min(availWidth, h / a), h };
}

/** The pet, given the room it deserves: the frame takes the PHOTO's shape
 *  (up to maxHeight), centered, so the whole animal is always visible.
 *  Only when the intrinsic size is unreadable do we fall back to a crop. */
function PhotoBlock({ data, maxHeight, availWidth, radius = 10 }) {
  const src = data.photos[0];
  if (!src) {
    return (
      <View
        style={{
          height: maxHeight,
          borderRadius: radius,
          backgroundColor: T.midnight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paw size={Math.max(56, maxHeight * 0.24)} />
        <Text style={{ color: '#94a3b8', fontWeight: 600, fontSize: Math.max(9, maxHeight * 0.038), marginTop: 10 }}>
          No photo yet. Please go by the description.
        </Text>
      </View>
    );
  }
  if (data.photoAspect) {
    const { w, h } = photoDims(data, maxHeight, availWidth);
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden' }}>
          <Image src={src} style={{ width: w, height: h }} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ height: maxHeight, borderRadius: radius, overflow: 'hidden' }}>
      <Image src={src} style={{ width: '100%', height: maxHeight, objectFit: 'cover', objectPositionY: '25%' }} />
    </View>
  );
}

/** Name + identity chips. */
function NameRow({ data, width, base = 44, center = false }) {
  const name = data.petName.toUpperCase();
  const chips = data.chips.join('  ·  ') + (data.microchipped ? `${data.chips.length ? '  ·  ' : ''}Microchipped` : '');
  return (
    <View style={{ alignItems: center ? 'center' : 'flex-start' }}>
      <Text style={{ color: T.midnight, fontWeight: 900, fontSize: fitSize(name, width, base, 18), letterSpacing: -0.5 }}>
        {name}
      </Text>
      {chips ? (
        <Text style={{ color: T.mute, fontWeight: 600, fontSize: Math.max(10, base * 0.26), marginTop: 3 }}>{chips}</Text>
      ) : null}
    </View>
  );
}

/** Quiet spec table: LOOK FOR / IF YOU SEE / LAST SEEN. Hairline rules, no boxes. */
function SpecTable({ data, compact = false }) {
  const rows = [
    data.markings ? { label: 'LOOK FOR', value: data.markings } : null,
    { label: `IF YOU SEE ${data.petName.toUpperCase()}`, value: data.approachLine },
    {
      label: 'LAST SEEN',
      value: [data.lastSeenArea, data.lastSeenWhen].filter(Boolean).join('  ·  '),
    },
  ].filter(Boolean);
  const labelW = compact ? 92 : 104;
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
              color: data.accent,
              fontWeight: 900,
              letterSpacing: 0.8,
              marginTop: 1,
            }}
          >
            {r.label}
          </Text>
          <Text style={{ flex: 1, fontSize: fs, color: T.midnight, fontWeight: 600, lineHeight: 1.4 }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** High-contrast contact band: huge auto-fit phone/email + QR on a white tile. */
function ContactBand({ data, pad, phoneBase, qrSize, showUrl = true }) {
  const qrTile = data.qrDataUrl ? qrSize + 14 : 0;
  const textW = PAGE_W(data) - pad * 2 - (qrTile ? qrTile + 18 : 0);
  // Emails and URLs read better (and calmer) smaller than a phone number.
  const isPhone = /^[\d\s()+\-.]+$/.test(data.contactValue || '');
  const valueBase = isPhone ? phoneBase : phoneBase * 0.68;
  return (
    <View style={{ backgroundColor: T.midnight, paddingHorizontal: pad, paddingVertical: pad * 0.55 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.flash, fontWeight: 700, fontSize: phoneBase * 0.26, letterSpacing: 2 }}>
            {data.contactVerb}
          </Text>
          <Text
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: fitSize(data.contactValue, textW, valueBase, 11),
              marginTop: 2,
            }}
          >
            {data.contactValue}
          </Text>
          {data.contactSecondary ? (
            <Text style={{ color: '#94a3b8', fontSize: phoneBase * 0.24, marginTop: 3 }}>{data.contactSecondary}</Text>
          ) : null}
          {showUrl && data.contactValue !== data.caseUrlLabel ? (
            <Text style={{ color: '#64748b', fontSize: Math.max(7.5, phoneBase * 0.17), marginTop: 5 }}>
              {data.caseUrlLabel}
            </Text>
          ) : null}
        </View>
        {data.qrDataUrl ? (
          <View style={{ alignItems: 'center', marginLeft: 18 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 7 }}>
              <Image src={data.qrDataUrl} style={{ width: qrSize, height: qrSize }} />
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 7.5, fontWeight: 600, marginTop: 4, maxWidth: qrSize + 14, textAlign: 'center' }}>
              {data.scanCta}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Real tear-off tabs: rotated so the number runs up the tab, dashed cut lines. */
function TearTabs({ data, count = 10, height = 128 }) {
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

// Page width by variant — normalize carries no page info, so stash it on data
// at render time (set in FlyerDocument below).
function PAGE_W(data) {
  return data._pageW || PAGE.LETTER.width;
}

const M = 34; // letter margin
const MP = 48; // poster margin

function ClassicLetter({ data }) {
  const bodyW = PAGE.LETTER.width - M * 2;
  // Portrait photos get a side-by-side hero (tall photo, name beside it) so
  // showing the WHOLE pet doesn't shrink the photo to a stamp.
  const isPortrait = Boolean(data.photos[0]) && data.photoAspect > 1.05;
  const heroH = data.reward ? 336 : 356;
  const pw = isPortrait ? photoDims(data, heroH, bodyW * 0.46).w : 0;
  return (
    <Page size="LETTER" style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <HeaderBand data={data} height={data.reward ? 88 : 96} pad={M} />
      <RewardStrip data={data} height={32} fontSize={15} />
      <View style={{ flexGrow: 1, paddingHorizontal: M, paddingTop: 18, paddingBottom: 16 }}>
        {isPortrait ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PhotoBlock data={data} maxHeight={heroH} availWidth={bodyW * 0.46} />
            <View style={{ flex: 1, paddingLeft: 20 }}>
              <NameRow data={data} width={bodyW - pw - 20} base={40} />
              <Text style={{ color: T.slate, fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>{data.plea}</Text>
            </View>
          </View>
        ) : (
          <>
            <PhotoBlock data={data} maxHeight={data.reward ? 250 : 262} availWidth={bodyW} />
            <View style={{ marginTop: 15 }}>
              <NameRow data={data} width={bodyW} base={40} />
            </View>
            <Text style={{ color: T.slate, fontSize: 11, lineHeight: 1.5, marginTop: 7 }}>{data.plea}</Text>
          </>
        )}
        <SpecTable data={data} />
        <View style={{ flexGrow: 1 }} />
      </View>
      <ContactBand data={data} pad={M} phoneBase={40} qrSize={88} />
    </Page>
  );
}

function TearTabFlyer({ data }) {
  const photoSide = data.reward ? 244 : 268;
  return (
    <Page size="LETTER" style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <HeaderBand data={data} height={64} pad={M} />
      <RewardStrip data={data} height={26} fontSize={12.5} />
      <View style={{ flexGrow: 1, paddingHorizontal: M, paddingTop: 16, paddingBottom: 14 }}>
        <View style={{ flexGrow: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: photoSide }}>
            {data.photos[0] ? (
              <PhotoBlock data={data} maxHeight={photoSide} availWidth={photoSide} />
            ) : (
              <View style={{ height: photoSide, borderRadius: 10, backgroundColor: T.midnight, alignItems: 'center', justifyContent: 'center' }}>
                <Paw size={56} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, paddingLeft: 18, justifyContent: 'center' }}>
            <NameRow data={data} width={PAGE.LETTER.width - M * 2 - photoSide - 18} base={34} />
            <Text style={{ color: T.slate, fontSize: 10.5, lineHeight: 1.5, marginTop: 8 }}>{data.plea}</Text>
          </View>
        </View>
        <View style={{ flexGrow: 1 }} />
        <SpecTable data={data} compact />
      </View>
      <ContactBand data={data} pad={M} phoneBase={30} qrSize={62} showUrl={false} />
      <TearTabs data={data} />
    </Page>
  );
}

function YardPoster({ data }) {
  const W = PAGE.TABLOID.width;
  return (
    <Page size={[W, PAGE.TABLOID.height]} style={{ fontFamily: 'Inter', backgroundColor: T.paper }}>
      <HeaderBand data={data} height={data.reward ? 150 : 164} pad={MP} />
      <RewardStrip data={data} height={52} fontSize={26} />
      <View style={{ flexGrow: 1, paddingHorizontal: MP, paddingTop: 26, paddingBottom: 22 }}>
        <PhotoBlock data={data} maxHeight={data.reward ? 480 : 528} availWidth={W - MP * 2} radius={14} />
        <View style={{ marginTop: 22, alignItems: 'center' }}>
          <NameRow data={data} width={W - MP * 2} base={64} center />
        </View>
        <Text style={{ color: T.slate, fontSize: 15, lineHeight: 1.45, marginTop: 12, textAlign: 'center' }}>
          {data.plea}
        </Text>
        {data.markings ? (
          <Text style={{ color: T.midnight, fontWeight: 700, fontSize: 16, marginTop: 12, textAlign: 'center' }}>
            <Text style={{ color: data.accent, fontWeight: 900 }}>LOOK FOR:  </Text>
            {data.markings}
          </Text>
        ) : null}
        <Text style={{ color: T.midnight, fontWeight: 700, fontSize: 16, marginTop: 8, textAlign: 'center' }}>
          <Text style={{ color: data.accent, fontWeight: 900 }}>LAST SEEN:  </Text>
          {[data.lastSeenArea, data.lastSeenWhen].filter(Boolean).join('  ·  ')}
        </Text>
        <View style={{ flexGrow: 1 }} />
      </View>
      <ContactBand data={data} pad={MP} phoneBase={58} qrSize={132} />
    </Page>
  );
}

const VARIANTS = { classic: ClassicLetter, tabs: TearTabFlyer, poster: YardPoster };

export function FlyerDocument({ data, variant = 'classic' }) {
  const Variant = VARIANTS[variant] || ClassicLetter;
  const pageW = variant === 'poster' ? PAGE.TABLOID.width : PAGE.LETTER.width;
  return (
    <Document title={`${data.stamp} ${data.petName} (${data.caseNumber})`} author="ReunitePets">
      <Variant data={{ ...data, _pageW: pageW }} />
    </Document>
  );
}
