/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image, Svg, Circle } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf, fitUnbounded, fitInter, interEm, eyebrowW, UNBOUNDED, STICKER } from './plan';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * the sticker" (design px × 0.75 = pt).
 *
 * A sticker on a yellow sheet. The pet's photo, cut into a circle with a
 * cream ring and a hard navy shadow, as big as the sheet allows. Under
 * it, centred: LOST in Unbounded, a wide face; the name; the last-seen
 * map beside where, when, what to look for and "If you see Max", the
 * line from the report's questionnaire (app/lib/caseDetails.js) that
 * tells a stranger what to do, with the health line in red when the pet
 * needs its medication; then the contact panel on
 * navy, every way to reach the family in one block: the phone number
 * with the email under it, the QR code, and the short link to the case
 * (reunitepets.org/p/HF27J2) for anyone who would rather type. The reward
 * is a cream tag on the sticker's right, "Needs medication" a red one on
 * its left, the tear tabs a cream strip along the foot. Yellow, navy,
 * cream: the site's own colours.
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
  lost: '#dc2626', // the pin: the brand's "lost" red
  mapGround: '#eef2f8',
};

/* ---------------------------------------------------------------- helpers */

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
      <Text style={{ maxLines: 1, textOverflow: 'ellipsis', fontFamily: 'Unbounded', fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color }}>
        {children}
      </Text>
    </View>
  );
}

const rewardLine = (data) => (data.reward === 'REWARD' ? 'Reward offered' : `${data.reward} reward`);

function contactEyebrow(data) {
  const who = `Seen ${data.petName}?`;
  if (data.hasPhone) return `${who} Call or text, any hour`;
  if (data.email) return `${who} Email, any hour`;
  return `${who} Report it at`;
}

const LINK_EYEBROW = 'Report a sighting';

/* ------------------------------------------------------------- primitives */

/** The photo as a round sticker: a cream ring, a hard navy shadow, the reward and "Needs medication" as tags. Without a photo, the description in the circle. */
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
      {data.needsMedication ? (
        <View
          style={{
            position: 'absolute',
            left: -3 * k,
            top: size * 0.08,
            backgroundColor: C.lost,
            borderWidth: 2.25 * k,
            borderColor: C.cream,
            borderRadius: 999,
            paddingVertical: 6 * k,
            paddingHorizontal: 13 * k,
          }}
        >
          <Text style={EYEBROW(Math.round(size * 0.034), C.cream)}>Needs medication</Text>
        </View>
      ) : null}
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

/** "Report a sighting" over the short link, in cream on navy. */
function LinkBlock({ data, k, w }) {
  return (
    <View style={{ width: w }}>
      <Text style={{ ...EYEBROW(7.5 * k, C.yellow), maxLines: 1, textOverflow: 'ellipsis' }}>{LINK_EYEBROW}</Text>
      <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(10 * k, C.cream, 700), marginTop: 3 * k, lineHeight: 1.2 }}>{data.caseUrlLabel}</Text>
    </View>
  );
}

/**
 * The contact panel: every way to reach the family in one navy block.
 * The phone number (or, without one, the email, or the short link) with
 * "or email" under it; then the QR code and the short link under "Report
 * a sighting". Side by side on a sheet; stacked where the column is
 * narrow (the half sheet). The link block is left out when the short
 * link is already the main line.
 */
function ContactPanel({ data, w, h, k, stacked = false, phoneBase = 34.5 }) {
  const padX = 18 * k;
  const qr = data.qrDataUrl ? (stacked ? 40 : 60) * k : 0;
  const mainIsLink = !data.hasPhone && !data.email;
  const link = mainIsLink ? '' : data.caseUrlLabel;
  const linkW = link ? Math.ceil(Math.max(interEm(link) * 10 * k, eyebrowW(LINK_EYEBROW, 7.5 * k))) : 0;
  const innerW = w - padX * 2;
  const leftW = stacked ? innerW : innerW - (qr ? qr + 12 * k : 0) - (linkW ? linkW + 9 * k : 0);
  const phone = fitUnbounded(data.contactValue, leftW, phoneBase * k, 10 * k);
  const emailLine = data.hasPhone && data.email ? `or email ${data.email}` : '';
  const emailSize = emailLine ? fitInter(emailLine, leftW, 9.75 * k, 7 * k) : 0;

  const main = (
    <View style={{ width: leftW }}>
      <Text style={{ ...EYEBROW(9 * k, C.yellow), maxLines: 1, textOverflow: 'ellipsis' }}>{contactEyebrow(data)}</Text>
      <View style={{ marginTop: 6 * k }}>
        <TightLine size={phone} color={C.cream}>{data.contactValue}</TightLine>
      </View>
      {emailLine ? <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(emailSize, C.cream, 500), marginTop: 6 * k, lineHeight: 1.2 }}>{emailLine}</Text> : null}
    </View>
  );
  const aside = qr || link ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: stacked ? 9 * k : 0, marginLeft: stacked ? 0 : 12 * k }}>
      {qr ? <QrTile data={data} size={qr} /> : null}
      {link ? (
        <View style={{ marginLeft: qr ? 9 * k : 0 }}>
          <LinkBlock data={data} k={k} w={linkW} />
        </View>
      ) : null}
    </View>
  ) : null;

  if (stacked) {
    return (
      <View style={{ width: w, backgroundColor: C.navy, borderRadius: 16 * k, paddingHorizontal: padX, paddingVertical: 11 * k }}>
        {main}
        {aside}
      </View>
    );
  }
  return (
    <View style={{ width: w, height: h, backgroundColor: C.navy, borderRadius: 20 * k, paddingHorizontal: padX, flexDirection: 'row', alignItems: 'center' }}>
      {main}
      {aside}
    </View>
  );
}

/**
 * The last-seen map: the cascade's tiles (render/staticMap.js) cropped
 * around the pin, a red halo and dot on the spot, a dashed distance ring
 * when one fits, "Last seen here" in a navy tag. Without a map (no point
 * on record, or the tiles did not come), a cream tile says where to look.
 */
function MapTile({ data, w, h, k, radius }) {
  const m = data.map;
  const r = radius ?? 10 * k;
  if (!m) {
    return (
      <View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', padding: 10 * k }}>
        <Text style={{ ...EYEBROW(7.5 * k, C.soft), textAlign: 'center' }}>Map at the link</Text>
      </View>
    );
  }
  const cx = w / 2;
  const cy = h / 2;
  const ox = cx - m.pin.x;
  const oy = cy - m.pin.y;
  const halo = Math.min(m.halo?.r || 20, Math.min(w, h) * 0.3);
  const ring = m.ring && m.ring.r <= Math.min(w, h) * 0.46 ? m.ring : null;
  return (
    <View style={{ width: w, height: h, borderRadius: r, overflow: 'hidden', backgroundColor: C.mapGround, borderWidth: 2.25 * k, borderColor: C.navy }}>
      <View style={{ position: 'absolute', left: ox, top: oy, width: m.width, height: m.height }}>
        {m.tiles.map((t, i) => (
          <Image key={i} src={t.src} style={{ position: 'absolute', left: t.left, top: t.top, width: 128, height: 128 }} />
        ))}
      </View>
      {ring ? (
        <Svg style={{ position: 'absolute', left: cx - ring.r, top: cy - ring.r }} width={ring.r * 2} height={ring.r * 2} viewBox={`0 0 ${ring.r * 2} ${ring.r * 2}`}>
          <Circle cx={ring.r} cy={ring.r} r={ring.r - 1} fill="none" stroke={C.navy} strokeWidth={1.2} strokeDasharray="4 3" />
        </Svg>
      ) : null}
      <Svg style={{ position: 'absolute', left: cx - halo, top: cy - halo }} width={halo * 2} height={halo * 2} viewBox={`0 0 ${halo * 2} ${halo * 2}`}>
        <Circle cx={halo} cy={halo} r={halo - 1.5} fill={C.lost} fillOpacity={0.2} stroke={C.lost} strokeWidth={2} />
      </Svg>
      <Svg style={{ position: 'absolute', left: cx - 7, top: cy - 7 }} width={14} height={14} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={5.2} fill={C.lost} stroke={C.cream} strokeWidth={2} />
      </Svg>
      <View style={{ position: 'absolute', left: 6 * k, top: 6 * k, backgroundColor: C.navy, borderRadius: 999, paddingVertical: 2.5 * k, paddingHorizontal: 7 * k }}>
        <Text style={EYEBROW(6 * k, C.cream)}>Last seen here</Text>
      </View>
      {ring ? (
        <View style={{ position: 'absolute', right: 6 * k, bottom: 7 * k, backgroundColor: C.cream, borderRadius: 999, paddingVertical: 2 * k, paddingHorizontal: 6 * k }}>
          <Text style={EYEBROW(5.5 * k, C.navy)}>{`${ring.label} ring`}</Text>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 3, paddingVertical: 1 }}>
        <Text style={{ fontFamily: 'Inter', fontSize: 4.5, color: C.soft }}>{m.attribution}</Text>
      </View>
    </View>
  );
}

/** Where and when, what to look for, then "If you see Max": what to do, beside the map. */
function Where({ data, k, w, lines = 2, lookSize = 10 }) {
  return (
    <View style={{ width: w, justifyContent: 'center' }}>
      <Text style={EYEBROW(8.25 * k)}>Last seen</Text>
      {data.lastSeenWhen ? <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(13.5 * k, C.navy, 700), marginTop: 2 * k, lineHeight: 1.2 }}>{data.lastSeenWhen}</Text> : null}
      <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(10.5 * k, C.soft, 500), lineHeight: 1.3 }}>{data.lastSeenArea}</Text>
      <Text style={{ maxLines: lines, textOverflow: 'ellipsis', ...BODY(lookSize * k), marginTop: 5 * k, lineHeight: 1.35 }}>
        {data.lookFor}
        {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
      </Text>
      <Advice data={data} k={k} size={10 * k} lines={data.health ? 2 : 3} marginTop={7 * k} />
    </View>
  );
}

/** "IF YOU SEE MAX", the health line in red when there is one, then what to do. */
function Advice({ data, k, size, lines = 2, marginTop = 0, align = 'left' }) {
  return (
    <View style={{ marginTop }}>
      <Text style={{ ...EYEBROW(8.25 * k), textAlign: align }}>{`If you see ${data.petName}`}</Text>
      {data.health ? (
        <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(size, C.lost, 700), lineHeight: 1.25, marginTop: 2 * k, textAlign: align }}>{data.health}</Text>
      ) : null}
      <Text style={{ maxLines: lines, textOverflow: 'ellipsis', ...BODY(size, C.navy, 600), lineHeight: 1.3, marginTop: data.health ? 1 * k : 2 * k, textAlign: align }}>{data.ifYouSee}</Text>
    </View>
  );
}

/** "LAST SEEN  Wed, Nov 4  Sach'a Yuntas" on one line, centred or not. */
function LastSeen({ data, k, align = 'center', w }) {
  return (
    <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...BODY(12 * k, C.soft, 400), textAlign: align, width: w, lineHeight: 1.2 }}>
      <Text style={EYEBROW(8.25 * k)}>Last seen  </Text>
      <Text style={{ fontWeight: 700, color: C.navy }}>{data.lastSeenWhen}</Text>
      {data.lastSeenWhen ? '   ' : ''}
      {data.lastSeenArea}
    </Text>
  );
}

function Facts({ data, k, w, lines = 2, align = 'center' }) {
  return (
    <Text style={{ maxLines: lines, textOverflow: 'ellipsis', ...BODY(12.75 * k), width: w, textAlign: align }}>
      {data.lookFor}
      {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
    </Text>
  );
}

/** Tear-off strip on cream: 8 tabs with the phone and the name; 4 wider ones when they carry the short link instead. */
function TearTabs({ data, w, h }) {
  const count = data.hasPhone ? 8 : 4;
  const tabW = w / count;
  const first = data.hasPhone ? data.contactValue : data.caseUrlLabel;
  const second = `${data.petName} · ${data.stamp}`;
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
  return (
    <Page size={[page.w, page.h]} style={{ backgroundColor: C.yellow, fontFamily: 'Inter', color: C.navy, paddingTop: plan.top, paddingHorizontal: side }}>
      <View style={{ alignItems: 'center' }}>
        <Sticker data={data} src={photoSrc} size={plan.sticker} k={k} />
      </View>
      <View style={{ marginTop: plan.gap, alignItems: 'center' }}>
        <TightLine size={plan.wordSize}>{data.stamp}</TightLine>
      </View>
      <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...NAME(fitInter(data.coverLine, contentW, 27 * k, 14 * k)), textAlign: 'center', marginTop: plan.nameGap, height: plan.name }}>{data.coverLine}</Text>
      <View style={{ marginTop: plan.rowGap, height: plan.row, flexDirection: 'row' }}>
        <MapTile data={data} w={plan.mapW} h={plan.row} k={k} />
        <View style={{ marginLeft: plan.rowGapX, width: contentW - plan.mapW - plan.rowGapX, height: plan.row }}>
          <Where data={data} k={k} w={contentW - plan.mapW - plan.rowGapX} lines={3} lookSize={9.5} />
        </View>
      </View>
      <View style={{ marginTop: plan.contactGap }}>
        <ContactPanel data={data} w={contentW} h={plan.contact} k={k} />
      </View>
      {plan.tabs > 0 ? (
        <View style={{ position: 'absolute', left: side, right: side, bottom: plan.bottom }}>
          <TearTabs data={data} w={contentW} h={plan.tabs} />
        </View>
      ) : null}
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
      <View style={{ position: 'absolute', left: colX, top: pad + 6, width: detailsW, height: plan.halfH - pad * 2 - 9 }}>
        <TightLine size={plan.wordSize}>{data.stamp}</TightLine>
        <Text style={{ maxLines: 1, textOverflow: 'ellipsis', ...NAME(fitInter(data.coverLine, detailsW, 19.5, 12)), marginTop: 7 }}>{data.coverLine}</Text>
        <View style={{ marginTop: 7 }}>
          <LastSeen data={data} k={k} align="left" w={detailsW} />
        </View>
        <View style={{ marginTop: 4 }}>
          <Facts data={data} k={k} w={detailsW} lines={2} align="left" />
        </View>
        <View style={{ marginTop: 6 }}>
          <MapTile data={data} w={detailsW} h={plan.mapH} k={k} />
        </View>
        <Advice data={data} k={k} size={9} lines={2} marginTop={6} />
        <View style={{ flex: 1 }} />
        <ContactPanel data={data} w={detailsW} k={k} stacked phoneBase={28} />
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
