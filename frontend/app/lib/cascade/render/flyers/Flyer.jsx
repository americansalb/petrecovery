import React from 'react';
import { Document, Font, Page, View, Text, Image, Svg, Path, Circle } from '@react-pdf/renderer';

// Break lines at spaces only — never hyphenate mid-word (no "·-" artifacts).
Font.registerHyphenationCallback((word) => [word]);

/**
 * "The photo IS the poster." Film-poster system:
 *  - The photograph runs edge to edge and owns the sheet. Portrait photos
 *    bleed a full column; landscape photos bleed the top of the page.
 *  - Every fact lives in ONE near-black panel. LOST {SPECIES} is set solid
 *    on that panel, never over the pet.
 *  - Reward is a red corner flag kissing the photo edge. Red appears only
 *    there and on the map pin; everything else is ink + paper, so the sheet
 *    prints beautifully in black and white.
 *  - No photo: a typographic cover (giant stacked LOST / DOG), not an apology.
 */

const C = {
  night: '#0f172a', // panel ink
  paper: '#ffffff',
  ice: '#e2e8f0', // primary secondary text on night
  mist: '#94a3b8', // labels on night
  dim: '#64748b',
  slate: '#334155',
  hair: '#e2e8f0',
  panelLine: '#33415a',
};

/* ---------------------------------------------------------------- helpers */

/** Estimate a string's width in ems for Inter Black — per-character classes. */
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

/** Largest font size (<= base) at which `text` fits one line in maxWidth pt. */
function fitSize(text, maxWidth, base, min = 9) {
  const em = estWidthEm(text) || 1;
  return Math.max(min, Math.min(base, maxWidth / em));
}

/** Reader-directed sighting guidance: the approach line recast so "get in
 *  touch" becomes the actual action ("call or text Sarah"), and any homing
 *  speculation is dropped. */
function recastApproach(data) {
  let s = String(data.approachLine || '').trim();
  const who = (data.ownerFirstName || '').trim();
  // Fallback verbs must not contain "right away": the source line may append
  // it, and "call right away right away" is exactly the kind of sloppiness
  // a stranger notices.
  let verb = 'report it with the QR code below';
  if (/CALL/i.test(data.contactVerb || '')) verb = who ? `call or text ${who}` : 'call or text';
  else if (/EMAIL/i.test(data.contactVerb || '')) verb = who ? `email ${who}` : 'email';
  s = s.replace(/,?\s*and trying to get home/i, '');
  s = s.replace(/get in touch right away\.?/i, `${verb} right away.`);
  s = s.replace(/get in touch\.?/i, `${verb}.`);
  s = s.replaceAll('—', ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/** Family-voice contact eyebrow: "PLEASE CALL OR TEXT SARAH · ANY TIME,
 *  DAY OR NIGHT" on wide layouts, shortened for narrow columns. */
function verbLine(data, { full = false } = {}) {
  const who = (data.ownerFirstName || '').trim();
  if (!who || /\sAT$/.test(data.contactVerb || '')) return data.contactVerb;
  const base = `PLEASE ${data.contactVerb} ${who.toUpperCase()}`;
  return full ? `${base} · ANY TIME, DAY OR NIGHT` : base;
}

/** "$500 REWARD" echo for the info panel so the reward survives grayscale
 *  and busy photos (the corner flag rides on photo texture). */
function rewardEcho(data) {
  if (!data.reward) return null;
  return data.reward === 'REWARD' ? 'REWARD OFFERED' : `${data.reward} REWARD`;
}

/** Bind the last two words with a non-breaking space so a lone word never
 *  widows on its own line. */
function noWidow(s) {
  return String(s || '').replace(/ (\S+)$/, '\u00a0$1');
}

function chipsLine(data) {
  const parts = [...(data.chips || [])];
  if (data.microchipped) parts.push('Microchipped');
  return parts.join(' · ');
}

/* ------------------------------------------------------------- components */

/** Full-bleed photo slab. Crops toward the face: vertical crops bias to the
 *  top quarter, horizontal crops stay centered. */
function Bleed({ src, aspect, x = 0, y = 0, w, h }) {
  const slotA = h / w;
  const style = { width: w, height: h, objectFit: 'cover' };
  if (!aspect) style.objectPositionY = '25%';
  else if (aspect > slotA) style.objectPositionY = '20%';
  else style.objectPositionX = '50%';
  return (
    <View
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', backgroundColor: '#e5e7eb' }}
    >
      <Image src={src} style={style} />
    </View>
  );
}

/** Red corner flag, flush to the sheet edge, bottom edge kissing `y`. */
function RewardFlag({ data, y, big = false }) {
  if (!data.reward) return null;
  const h = big ? 66 : 46;
  const flat = data.reward === 'REWARD';
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: y - h,
        height: h,
        backgroundColor: data.accent,
        paddingHorizontal: big ? 20 : 14,
        justifyContent: 'center',
      }}
    >
      {flat ? (
        <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: big ? 16 : 12, letterSpacing: 1.5 }}>
          REWARD OFFERED
        </Text>
      ) : (
        <>
          <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: big ? 30 : 22, letterSpacing: -0.5 }}>
            {data.reward}
          </Text>
          <Text style={{ color: '#ffffff', fontWeight: 700, fontSize: big ? 10 : 8, letterSpacing: 2.6, marginTop: 1 }}>
            REWARD
          </Text>
        </>
      )}
    </View>
  );
}

/** LOST / DOG stacked, each line fitted to the column width. */
function StackedLost({ data, w, maxH, color }) {
  let s1 = fitSize(data.stamp, w, 400, 12);
  let s2 = fitSize(data.speciesLabel, w, 400, 12);
  const total = (s1 + s2) * 0.92;
  if (maxH && total > maxH) {
    const k = maxH / total;
    s1 *= k;
    s2 *= k;
  }
  return (
    <View style={{ marginTop: -s1 * 0.14 }}>
      <Text style={{ color, fontWeight: 900, fontSize: s1, lineHeight: 1, letterSpacing: -1 }}>{data.stamp}</Text>
      <Text style={{ color, fontWeight: 900, fontSize: s2, lineHeight: 1, letterSpacing: -1, marginTop: -s2 * 0.2 }}>
        {data.speciesLabel}
      </Text>
    </View>
  );
}

/** LOOK FOR / LAST SEEN / IF YOU SEE {NAME} — label over value, no boxes. */
function DetailRows({ data, dark = false, fs = 9.5, labelFs = 7, gap = 10 }) {
  const rows = [];
  if (data.markings) rows.push(['LOOK FOR', noWidow(data.markings)]);
  rows.push(['LAST SEEN', [data.lastSeenArea, data.lastSeenWhen].filter(Boolean).join(' · ')]);
  rows.push([`IF YOU SEE ${data.petName.toUpperCase()}`, noWidow(recastApproach(data))]);
  const labelColor = dark ? C.mist : C.dim;
  const valueColor = dark ? C.ice : C.night;
  return (
    <View>
      {rows.map(([label, value], i) => (
        <View key={i} style={{ marginTop: i ? gap : 0 }}>
          <Text style={{ color: labelColor, fontWeight: 700, fontSize: labelFs, letterSpacing: 1.2 }}>{label}</Text>
          <Text style={{ color: valueColor, fontWeight: 600, fontSize: fs, lineHeight: 1.4, marginTop: 2.5 }}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Docked last-seen map: centered crop of the stitched tile spec + red pin. */
function MapDock({ data, w, h, dark = false }) {
  const m = data.map;
  if (!m) return null;
  const ox = (w - m.width) / 2;
  const oy = (h - m.height) / 2;
  const px = ox + m.pin.x;
  const py = oy + m.pin.y;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', borderWidth: 1, borderColor: dark ? '#3b4a63' : '#cbd5e1' }}>
      <View style={{ position: 'absolute', left: ox, top: oy, width: m.width, height: m.height }}>
        {m.tiles.map((t, i) => (
          <Image
            key={i}
            src={t.src}
            style={{ position: 'absolute', left: t.left, top: t.top, width: 128, height: 128 }}
          />
        ))}
      </View>
      {m.ring && m.ring.r <= Math.min(w, h) * 0.48 ? (
        <>
          <Svg
            style={{ position: 'absolute', left: px - m.ring.r, top: py - m.ring.r }}
            width={m.ring.r * 2}
            height={m.ring.r * 2}
            viewBox={`0 0 ${m.ring.r * 2} ${m.ring.r * 2}`}
          >
            <Circle
              cx={m.ring.r}
              cy={m.ring.r}
              r={m.ring.r - 1.2}
              fill="none"
              stroke="#dc2626"
              strokeWidth={1.2}
              strokeDasharray="4,3"
            />
          </Svg>
          <Text
            style={{
              position: 'absolute',
              left: px - 26,
              top: Math.min(h - 10, py + m.ring.r - 10),
              width: 52,
              textAlign: 'center',
              fontSize: 6,
              fontWeight: 900,
              color: '#dc2626',
              letterSpacing: 0.7,
            }}
          >
            {m.ring.label}
          </Text>
        </>
      ) : null}
      <Svg style={{ position: 'absolute', left: px - 9, top: py - 23 }} width={18} height={23} viewBox="0 0 22 28">
        <Path
          d="M11 0C5 0 0.5 4.6 0.5 10.4 0.5 18 11 28 11 28s10.5-10 10.5-17.6C21.5 4.6 17 0 11 0z"
          fill="#dc2626"
        />
        <Circle cx="11" cy="10.4" r="4" fill="#ffffff" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 5,
          top: 5,
          backgroundColor: '#ffffff',
          paddingVertical: 2.5,
          paddingHorizontal: 6,
        }}
      >
        <Text style={{ fontSize: 6, fontWeight: 900, color: C.night, letterSpacing: 0.8 }}>LAST SEEN HERE</Text>
      </View>
      <Text style={{ position: 'absolute', right: 3, bottom: 2, fontSize: 4.5, color: '#475569' }}>{m.attribution}</Text>
    </View>
  );
}

/** Wide contact block: rule, CALL OR TEXT SARAH, giant value, QR at right. */
function ContactWide({ data, w, dark = false, base = 44, qr = 66 }) {
  const qrBox = data.qrDataUrl ? qr + 8 : 0;
  const textW = w - (qrBox ? qrBox + 16 : 0);
  const size = fitSize(data.contactValue, textW, base, 12);
  const main = dark ? '#ffffff' : C.night;
  const sub = dark ? C.mist : C.dim;
  return (
    <View>
      {rewardEcho(data) ? (
        <Text
          style={{ color: main, fontWeight: 900, fontSize: Math.max(9, base * 0.24), letterSpacing: 1.8, marginBottom: 7 }}
        >
          {rewardEcho(data)}
        </Text>
      ) : null}
      <View style={{ height: 2, backgroundColor: main }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: base * 0.24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: sub, fontWeight: 700, fontSize: Math.max(8, base * 0.2), letterSpacing: 1.6 }}>
            {verbLine(data, { full: true })}
          </Text>
          <Text style={{ color: main, fontWeight: 900, fontSize: size, letterSpacing: -0.5, marginTop: 4 }}>
            {data.contactValue}
          </Text>
          {data.contactSecondary ? (
            <Text style={{ color: sub, fontWeight: 600, fontSize: Math.max(8, base * 0.18), marginTop: 4 }}>
              or {data.contactSecondary}
            </Text>
          ) : null}
          {data.contactValue !== data.caseUrlLabel ? (
            <Text style={{ color: dark ? C.dim : C.mist, fontSize: Math.max(7, base * 0.15), marginTop: 6 }}>
              {data.caseUrlLabel}
            </Text>
          ) : null}
        </View>
        {data.qrDataUrl ? (
          <View style={{ alignItems: 'center', marginLeft: 16 }}>
            <View style={{ backgroundColor: '#ffffff', padding: 4, borderWidth: dark ? 0 : 1, borderColor: C.hair }}>
              <Image src={data.qrDataUrl} style={{ width: qr, height: qr }} />
            </View>
            <Text
              style={{
                color: sub,
                fontSize: 8,
                fontWeight: 600,
                marginTop: 3,
                maxWidth: qr + 30,
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

/** Narrow-column contact: full-width value, QR docked beneath. */
function ContactColumn({ data, w, base = 30, qr = 54 }) {
  const size = fitSize(data.contactValue, w, base, 11);
  return (
    <View>
      {rewardEcho(data) ? (
        <Text
          style={{ color: '#ffffff', fontWeight: 900, fontSize: Math.max(9, base * 0.3), letterSpacing: 1.6, marginBottom: 8 }}
        >
          {rewardEcho(data)}
        </Text>
      ) : null}
      <View style={{ height: 2, backgroundColor: '#ffffff' }} />
      <Text style={{ color: C.mist, fontWeight: 700, fontSize: Math.max(8, base * 0.26), letterSpacing: 1.6, marginTop: 10 }}>
        {verbLine(data)}
      </Text>
      <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: size, letterSpacing: -0.5, marginTop: 4 }}>
        {data.contactValue}
      </Text>
      {data.contactSecondary ? (
        <Text style={{ color: C.mist, fontWeight: 600, fontSize: Math.max(7.5, base * 0.24), marginTop: 3 }}>
          or {data.contactSecondary}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        {data.qrDataUrl ? (
          <View style={{ backgroundColor: '#ffffff', padding: 3.5 }}>
            <Image src={data.qrDataUrl} style={{ width: qr, height: qr }} />
          </View>
        ) : null}
        <View style={{ marginLeft: data.qrDataUrl ? 10 : 0, flex: 1 }}>
          <Text style={{ color: C.ice, fontSize: 8, fontWeight: 600, lineHeight: 1.35 }}>{data.scanCta}</Text>
          <Text style={{ color: C.dim, fontSize: 7.5, marginTop: 3 }}>{data.caseUrlLabel}</Text>
        </View>
      </View>
    </View>
  );
}

/** Typographic cover for the no-photo case: giant stacked LOST / DOG on paper. */
function CoverType({ data, w, h, pad, descFs }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        backgroundColor: C.paper,
        paddingHorizontal: pad,
        paddingTop: pad,
        paddingBottom: pad * 0.8,
        justifyContent: 'space-between',
      }}
    >
      <StackedLost data={data} w={w - pad * 2} maxH={h - pad * 2 - descFs * 4.2} color={C.night} />
      <View>
        <Text style={{ color: C.dim, fontWeight: 700, fontSize: descFs * 0.68, letterSpacing: 1.6 }}>
          GO BY THE DESCRIPTION
        </Text>
        <Text style={{ color: C.night, fontWeight: 700, fontSize: descFs, lineHeight: 1.35, marginTop: 3 }}>
          {noWidow(data.description || chipsLine(data))}
        </Text>
      </View>
    </View>
  );
}

/** Real tear-off tabs: rotated text, dashed cut lines. */
function TearTabs({ data, width, top, count = 9, height = 116 }) {
  const tabW = width / count;
  const inner = { w: height - 14, h: tabW - 8 };
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top,
        width,
        flexDirection: 'row',
        height,
        borderTopWidth: 1.2,
        borderTopColor: C.mist,
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
            borderRightColor: C.mist,
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
            <Text style={{ color: C.night, fontWeight: 900, fontSize: fitSize(data.contactValue, inner.w, 11.5, 6) }}>
              {data.contactValue}
            </Text>
            <Text style={{ color: C.dim, fontWeight: 600, fontSize: 7, marginTop: 2, letterSpacing: 0.5 }}>
              {data.stamp} {data.speciesLabel} · {data.petName.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- layouts */

/** Portrait photo: the photo bleeds a full column; one night panel beside it. */
function ColumnSheet({ data, P }) {
  const colW = Math.round(P.W * 0.58);
  const panW = P.W - colW;
  const cw = panW - P.pad * 2;
  return (
    <Page size={[P.W, P.H]} style={{ fontFamily: 'Inter' }}>
      <Bleed src={data.photos[0]} aspect={data.photoAspect} w={colW} h={P.H} />
      <View
        style={{
          position: 'absolute',
          left: colW,
          top: 0,
          width: panW,
          height: P.H,
          backgroundColor: C.night,
          paddingHorizontal: P.pad,
          paddingTop: P.padTop,
          paddingBottom: P.padBot,
        }}
      >
        <StackedLost data={data} w={cw} maxH={P.lostMaxH} color="#ffffff" />
        {data.lastSeenWhen ? (
          <Text style={{ color: C.mist, fontWeight: 700, fontSize: P.labelFs + 1, letterSpacing: 1.8, marginTop: 8 }}>
            MISSING SINCE {data.lastSeenWhen.toUpperCase()}
          </Text>
        ) : null}
        <View style={{ height: 1.5, backgroundColor: C.panelLine, marginTop: 12 }} />
        <Text
          style={{
            color: '#ffffff',
            fontWeight: 900,
            fontSize: fitSize(data.petName.toUpperCase(), cw, P.nameBase, 16),
            letterSpacing: -0.5,
            lineHeight: 1,
            marginTop: 16,
          }}
        >
          {data.petName.toUpperCase()}
        </Text>
        <Text style={{ color: C.mist, fontWeight: 600, fontSize: P.chipFs, lineHeight: 1.5, marginTop: 5 }}>
          {chipsLine(data)}
        </Text>
        <View style={{ marginTop: P.gap + 2 }}>
          <DetailRows data={data} dark fs={P.fs} labelFs={P.labelFs} gap={P.gap} />
        </View>
        <View style={{ height: P.gap + 4 }} />
        <MapDock data={data} w={cw} h={P.mapH} dark />
        <View style={{ flexGrow: 1, minHeight: P.gap }} />
        <ContactColumn data={data} w={cw} base={P.contactBase} qr={P.qr} />
      </View>
      <RewardFlag data={data} y={P.H} big={P.big} />
    </Page>
  );
}

/** Landscape photo (or typographic cover): bleed on top, night panel below. */
function StackSheet({ data, P }) {
  const hasPhoto = Boolean(data.photos[0]);
  const photoH = Math.round(P.H * P.photoFrac);
  const panH = P.H - photoH;
  const cw = P.W - P.pad * 2;
  const label = `${data.stamp} ${data.speciesLabel}`;
  return (
    <Page size={[P.W, P.H]} style={{ fontFamily: 'Inter' }}>
      {hasPhoto ? (
        <Bleed src={data.photos[0]} aspect={data.photoAspect} w={P.W} h={photoH} />
      ) : (
        <CoverType data={data} w={P.W} h={photoH} pad={P.coverPad} descFs={P.coverFs} />
      )}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: photoH,
          width: P.W,
          height: panH,
          backgroundColor: C.night,
          paddingHorizontal: P.pad,
          paddingTop: P.padTop,
          paddingBottom: P.padBot,
        }}
      >
        {hasPhoto ? (
          <>
            <Text
              style={{
                color: '#ffffff',
                fontWeight: 900,
                fontSize: fitSize(label, cw, P.lostBase, 24),
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              {label}
            </Text>
            {data.lastSeenWhen ? (
              <Text style={{ color: C.mist, fontWeight: 700, fontSize: P.labelFs + 1, letterSpacing: 1.8, marginTop: 9 }}>
                MISSING SINCE {data.lastSeenWhen.toUpperCase()}
              </Text>
            ) : null}
          </>
        ) : (
          <Text
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: fitSize(data.petName.toUpperCase(), cw, P.lostBase * 0.72, 24),
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {data.petName.toUpperCase()}
          </Text>
        )}
        <View style={{ flexDirection: 'row', marginTop: P.gap + 4 }}>
          <View style={{ flex: 1, paddingRight: 18 }}>
            {hasPhoto ? (
              <>
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: fitSize(data.petName.toUpperCase(), cw - P.mapW - 18, P.nameBase, 14),
                    letterSpacing: -0.5,
                    lineHeight: 1,
                  }}
                >
                  {data.petName.toUpperCase()}
                </Text>
                <Text style={{ color: C.mist, fontWeight: 600, fontSize: P.chipFs, lineHeight: 1.5, marginTop: 4 }}>
                  {chipsLine(data)}
                </Text>
                <View style={{ marginTop: P.gap }}>
                  <DetailRows data={data} dark fs={P.fs} labelFs={P.labelFs} gap={P.gap - 2} />
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: C.mist, fontWeight: 600, fontSize: P.chipFs, lineHeight: 1.5 }}>
                  {chipsLine(data)}
                </Text>
                <View style={{ marginTop: P.gap }}>
                  <DetailRows data={data} dark fs={P.fs} labelFs={P.labelFs} gap={P.gap - 2} />
                </View>
              </>
            )}
          </View>
          <View style={{ alignSelf: 'center' }}>
            <MapDock data={data} w={P.mapW} h={P.mapH} dark />
          </View>
        </View>
        <View style={{ flexGrow: 1, minHeight: 10 }} />
        <ContactWide data={data} w={cw} dark base={P.contactBase} qr={P.qr} />
      </View>
      <RewardFlag data={data} y={photoH} big={P.big} />
    </Page>
  );
}

const P_LETTER = {
  W: 612,
  H: 792,
  photoFrac: 0.5,
  pad: 28,
  padTop: 20,
  padBot: 18,
  lostBase: 80,
  lostMaxH: 170,
  nameBase: 38,
  chipFs: 9,
  fs: 9.5,
  labelFs: 7,
  gap: 11,
  mapW: 196,
  mapH: 142,
  contactBase: 42,
  qr: 62,
  big: false,
  coverPad: 30,
  coverFs: 12,
};

const P_LETTER_COL = {
  ...P_LETTER,
  pad: 20,
  padTop: 30,
  padBot: 20,
  nameBase: 44,
  mapH: 196,
  contactBase: 30,
  qr: 52,
  gap: 12,
  fs: 10,
};

const P_POSTER = {
  W: 792,
  H: 1224,
  photoFrac: 0.54,
  pad: 36,
  padTop: 28,
  padBot: 32,
  lostBase: 118,
  lostMaxH: 240,
  nameBase: 54,
  chipFs: 11.5,
  fs: 12.5,
  labelFs: 9,
  gap: 15,
  mapW: 280,
  mapH: 216,
  contactBase: 60,
  qr: 102,
  big: true,
  coverPad: 40,
  coverFs: 18,
};

const P_POSTER_COL = {
  ...P_POSTER,
  pad: 26,
  padTop: 42,
  padBot: 30,
  nameBase: 64,
  mapH: 316,
  contactBase: 44,
  qr: 96,
  gap: 18,
  fs: 13,
  labelFs: 9.5,
  chipFs: 12,
};

function ClassicSheet({ data, P, PCOL }) {
  const isPortrait = Boolean(data.photos[0]) && data.photoAspect > 1.05;
  return isPortrait ? <ColumnSheet data={data} P={PCOL} /> : <StackSheet data={data} P={P} />;
}

/** Letter with tear-off tabs: photo bleed, LOST band, compact info, tabs. */
function TabsSheet({ data }) {
  const W = 612;
  const H = 792;
  const tabsH = 116;
  const hasPhoto = Boolean(data.photos[0]);
  const photoH = hasPhoto ? 352 : 412;
  const bandH = hasPhoto ? 60 : 0;
  const infoTop = photoH + bandH;
  const infoH = H - tabsH - infoTop;
  const padH = 26;
  const cw = W - padH * 2;
  const mapW = 150;
  const label = `${data.stamp} ${data.speciesLabel}`;
  return (
    <Page size={[W, H]} style={{ fontFamily: 'Inter' }}>
      {hasPhoto ? (
        <Bleed src={data.photos[0]} aspect={data.photoAspect} w={W} h={photoH} />
      ) : (
        <CoverType data={data} w={W} h={photoH} pad={28} descFs={10.5} />
      )}
      {hasPhoto ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: photoH,
            width: W,
            height: bandH,
            backgroundColor: C.night,
            justifyContent: 'center',
            paddingHorizontal: padH,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontWeight: 900,
              fontSize: fitSize(label, cw, 46, 20),
              letterSpacing: -0.5,
              lineHeight: 1,
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: infoTop,
          width: W,
          height: infoH,
          paddingHorizontal: padH,
          paddingTop: 13,
          paddingBottom: 12,
          borderTopWidth: hasPhoto ? 0 : 2,
          borderTopColor: C.night,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text
              style={{
                color: C.night,
                fontWeight: 900,
                fontSize: fitSize(data.petName.toUpperCase(), cw - mapW - 14, 25, 13),
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              {data.petName.toUpperCase()}
            </Text>
            <Text style={{ color: C.dim, fontWeight: 600, fontSize: 8.5, lineHeight: 1.45, marginTop: 3 }}>
              {chipsLine(data)}
            </Text>
            <View style={{ marginTop: 7 }}>
              <DetailRows data={data} fs={8.5} labelFs={7} gap={6.5} />
            </View>
          </View>
          <MapDock data={data} w={mapW} h={112} />
        </View>
        <View style={{ flexGrow: 1, minHeight: 7 }} />
        <ContactWide data={data} w={cw} base={30} qr={48} />
      </View>
      <RewardFlag data={data} y={photoH} />
      <TearTabs data={data} width={W} top={H - tabsH} height={tabsH} />
    </Page>
  );
}

const VARIANTS = {
  classic: (data) => <ClassicSheet data={data} P={P_LETTER} PCOL={P_LETTER_COL} />,
  tabs: (data) => <TabsSheet data={data} />,
  poster: (data) => <ClassicSheet data={data} P={P_POSTER} PCOL={P_POSTER_COL} />,
};

export function FlyerDocument({ data, variant = 'classic' }) {
  const render = VARIANTS[variant] || VARIANTS.classic;
  return (
    <Document title={`${data.stamp} ${data.petName} (${data.caseNumber})`} author="ReunitePets">
      {render(data)}
    </Document>
  );
}
