/** @jsxRuntime classic */
/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from './pdfReact';
import { Document, Font, Page, View, Text, Image, Svg, Circle, Defs, RadialGradient, Stop, Rect, Polygon } from '@react-pdf/renderer';
import { PAGES, planSheet, planHalf, fitUnbounded, fitInter, interEm, eyebrowW, unboundedEm, UNBOUNDED, PRINT, BAND, bandBox, printInner } from './plan';
import { grainDataUrl, GRAIN_TILE } from '../textures';
import { GROUND, LIGHT, rayPolygons, stripePolygons, bands } from '../ground';

// Break lines at spaces only; never hyphenate mid-word.
Font.registerHyphenationCallback((word) => [word]);

/**
 * The flyer PDFs, drawn from the Claude Design canvas "Lost Pet Flyers,
 * the sticker" (design px × 0.75 = pt).
 *
 * A photo print on a yellow sheet that is lit, not filled: the brand's
 * yellow brightest behind the photo and deepening to amber at the
 * corners, sun rays fanning out from the same point, caution stripes
 * along the edge, fine grain over it all (render/ground.js). The pet's
 * photo fills the width of the sheet, as tall as the sheet allows, in a
 * cream mat with a navy edge and a hard navy shadow, like a print stuck
 * on. Under it, centred: LOST in Unbounded, cream on a red band set a
 * touch askew with the same hard shadow; the name; the last-seen map
 * beside where, when and what to look for; then "If you see Max" on a
 * cream note card the full width of the sheet, so the instruction is
 * never cut, with the health line in red; then the contact panel on
 * navy: the phone number with the email under it, the QR code, and the
 * short link for anyone who would rather type. The reward and "Needs
 * medication" are tags on the print's corners, the tear tabs a strip
 * along the foot.
 *
 * The layout comes from ./plan.js: every block under the photo has a set
 * height and the photo takes what is left. The photo arrives already cut
 * to the print's shape around the pet (index.js, render/photo.js).
 *
 *  - FLYER_LETTER: Letter, tear tabs at the foot.
 *  - FLYER_HALF: two half sheets on one Letter page, the print beside the words.
 *  - FLYER_POSTER: 11 × 17, the Letter sheet scaled, no tabs.
 */

const C = {
  yellow: GROUND.yellow,
  navy: GROUND.ink,
  cream: '#fffbea',
  soft: '#3b3a2e',
  dash: '#0f172a',
  lost: '#dc2626', // the pin and the health line: the brand's "lost" red
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
const CLAMP = (n) => ({ maxLines: n, textOverflow: 'ellipsis' });

/**
 * One line of Unbounded that takes exactly its cap height on the sheet:
 * the line box is pulled up by the air above the caps and trimmed to the
 * baseline (UNBOUNDED in plan.js). react-pdf drops a line that does not
 * fit a fixed-height box, so the box here is never fixed.
 */
function TightLine({ size, color = C.navy, style = {}, children }) {
  return (
    <View style={{ marginTop: -UNBOUNDED.top * size, marginBottom: (UNBOUNDED.top + UNBOUNDED.cap - 1) * size, ...style }}>
      <Text style={{ ...CLAMP(1), fontFamily: 'Unbounded', fontSize: size, lineHeight: 1, letterSpacing: -size * 0.02, color }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The word in cream on a band of the stamp's colour (red for LOST), set a
 * touch askew, with the print's hard navy shadow behind it. The band and
 * the word turn about the same centre, so the word sits square in it.
 */
function Band({ size, color, children }) {
  const { w, h, off } = bandBox(size, children);
  const padX = BAND.padX * size;
  const pad = BAND.pad * size;
  const r = size * 0.1;
  const turn = 'rotate(-1.2deg)';
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ position: 'relative', width: w + off, height: h + off }}>
        <View style={{ position: 'absolute', left: off, top: off, width: w, height: h, borderRadius: r, backgroundColor: C.navy, transform: turn }} />
        <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, backgroundColor: color, transform: turn }} />
        <View style={{ position: 'absolute', left: padX, top: pad, width: w - padX * 2, transform: turn }}>
          <TightLine size={size} color={C.cream}>{children}</TightLine>
        </View>
      </View>
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

/**
 * The ground: the yellow lit from (cx, cy), behind the photo, to amber at
 * the corners; the rays from the same point; the caution-stripe band at
 * the head of the sheet and, unless `foot` is false (the Letter sheet,
 * whose foot is the tear tabs), at the foot; fine grain over it all. One
 * per sheet, `w` by `h`, filling its container, drawn under everything;
 * (cx, cy) in the sheet's own coordinates. `id` keeps two sheets on one
 * page (the half sheets) from sharing a gradient.
 */
function SheetGround({ w, h, cx, cy, stripe, foot = true, id = 'lit' }) {
  const tiles = [];
  const T = GRAIN_TILE * 1.5; // the tile in points: drawn at half density, which is grain enough on paper and keeps the file small
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) tiles.push([x, y]);
  const pts = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <RadialGradient id={id} cx={String(cx / w)} cy={String(cy / h)} r="0.95">
            {LIGHT.map(([offset, color]) => (
              <Stop key={offset} offset={String(offset)} stopColor={color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url('#${id}')`} />
        {rayPolygons({ w, h, cx, cy }).map((poly, i) => (
          <Polygon key={`r${i}`} points={pts(poly)} fill={GROUND.ink} fillOpacity={GROUND.rayOpacity} />
        ))}
        {bands({ h, s: stripe, foot }).map(({ y, s }) => (
          <Fragment key={y}>
            <Rect x={0} y={y} width={w} height={s} fill={GROUND.yellow} />
            {stripePolygons({ w, y, s }).map((poly, i) => (
              <Polygon key={`s${i}`} points={pts(poly)} fill={GROUND.ink} />
            ))}
          </Fragment>
        ))}
      </Svg>
      {tiles.map(([x, y]) => (
        <Image key={`${x}-${y}`} src={grainDataUrl()} style={{ position: 'absolute', left: x, top: y, width: T, height: T, opacity: 0.06 }} />
      ))}
    </View>
  );
}

/** A tag on the print's corner: the reward in cream, "Needs medication" in red. */
function Tag({ k, side, top, red = false, children }) {
  return (
    <View
      style={{
        position: 'absolute',
        [side]: 12 * k,
        top,
        backgroundColor: red ? C.lost : C.cream,
        borderWidth: 2.25 * k,
        borderColor: red ? C.cream : C.navy,
        borderRadius: 999,
        paddingVertical: 5 * k,
        paddingHorizontal: 12 * k,
      }}
    >
      <Text style={EYEBROW(8 * k, red ? C.cream : C.navy)}>{children}</Text>
    </View>
  );
}

/** The photo as a print: a cream mat in a navy edge, a hard navy shadow, the tags on its corners. Without a photo, the description on the print. */
function Print({ data, src, w, h, k }) {
  const off = Math.round(w * PRINT.shadow);
  const r = Math.round(w * PRINT.radius);
  const { edge, mat, w: pw, h: ph } = printInner(w, h, k);
  return (
    <View style={{ position: 'relative', width: w + off, height: h + off }}>
      <View style={{ position: 'absolute', left: off, top: off, width: w, height: h, borderRadius: r, backgroundColor: C.navy }} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, borderWidth: edge, borderColor: C.navy, backgroundColor: C.cream, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <Image src={src} style={{ width: pw, height: ph, borderRadius: Math.max(0, r - edge - mat), objectFit: 'cover' }} />
        ) : (
          <View style={{ width: w - edge * 2, paddingHorizontal: w * 0.1, alignItems: 'center' }}>
            <Text style={{ ...EYEBROW(8 * k, C.soft), textAlign: 'center', marginBottom: 8 * k }}>No photo yet. Please go by this.</Text>
            <Text style={{ ...NAME(fitInter(data.description || data.lookFor, w * 2.2, 20 * k, 11 * k)), textAlign: 'center', lineHeight: 1.2 }}>{data.description || data.lookFor}</Text>
            <Text style={{ ...BODY(8.5 * k, C.soft), textAlign: 'center', marginTop: 8 * k }}>A photo goes on the page at the link as soon as the family adds one.</Text>
          </View>
        )}
      </View>
      {data.reward ? (
        <Tag k={k} side="right" top={12 * k}>
          {rewardLine(data)}
        </Tag>
      ) : null}
      {data.needsMedication ? (
        <Tag k={k} side="left" top={12 * k} red>
          Needs medication
        </Tag>
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
      <Text style={{ ...EYEBROW(7.5 * k, C.yellow), ...CLAMP(1) }}>{LINK_EYEBROW}</Text>
      <Text style={{ ...CLAMP(1), ...BODY(10 * k, C.cream, 700), marginTop: 3 * k, lineHeight: 1.2 }}>{data.caseUrlLabel}</Text>
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
  const qr = data.qrDataUrl ? (stacked ? 40 : 58) * k : 0;
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
      <Text style={{ ...EYEBROW(9 * k, C.yellow), ...CLAMP(1) }}>{contactEyebrow(data)}</Text>
      <View style={{ marginTop: 6 * k }}>
        <TightLine size={phone} color={C.cream}>{data.contactValue}</TightLine>
      </View>
      {emailLine ? <Text style={{ ...CLAMP(1), ...BODY(emailSize, C.cream, 500), marginTop: 6 * k, lineHeight: 1.2 }}>{emailLine}</Text> : null}
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
      <View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.cream, borderWidth: 2.25 * k, borderColor: C.navy, alignItems: 'center', justifyContent: 'center', padding: 10 * k }}>
        <Text style={{ ...EYEBROW(7.5 * k, C.soft), textAlign: 'center' }}>Map at the link</Text>
        <Text style={{ ...BODY(8 * k, C.soft), textAlign: 'center', marginTop: 4 * k }}>{data.caseUrlLabel}</Text>
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

/** Where and when, then what to look for, beside the map. */
function Where({ data, k, w, lines = 3, lookSize = 10 }) {
  return (
    <View style={{ width: w, justifyContent: 'center' }}>
      <Text style={EYEBROW(8.25 * k)}>Last seen</Text>
      {data.lastSeenWhen ? <Text style={{ ...CLAMP(1), ...BODY(13.5 * k, C.navy, 700), marginTop: 2 * k, lineHeight: 1.2 }}>{data.lastSeenWhen}</Text> : null}
      <Text style={{ ...CLAMP(1), ...BODY(10.5 * k, C.soft, 500), lineHeight: 1.3 }}>{data.lastSeenArea}</Text>
      <Text style={{ ...CLAMP(lines), ...BODY(lookSize * k), marginTop: 5 * k, lineHeight: 1.35 }}>
        {data.lookFor}
        {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
      </Text>
    </View>
  );
}

/**
 * "IF YOU SEE MAX" on a cream note card with a navy edge: the health line
 * in red when there is one, then what to do. The full width, never cut.
 * `h` fixes the card's height on a planned sheet; the half sheet lets it
 * take its own.
 */
function Advice({ data, k, w, h, size = 10.5, lines = 3, marginTop = 0 }) {
  return (
    <View style={{ width: w, height: h, marginTop, backgroundColor: C.cream, borderRadius: 10 * k, borderWidth: 2 * k, borderColor: C.navy, paddingVertical: 6 * k, paddingHorizontal: 10 * k }}>
      <Text style={EYEBROW(8.25 * k)}>{`If you see ${data.petName}`}</Text>
      {data.health ? (
        <Text style={{ ...CLAMP(1), ...BODY(size * k, C.lost, 700), lineHeight: 1.3, marginTop: 2 * k }}>{data.health}</Text>
      ) : null}
      <Text style={{ ...CLAMP(lines), ...BODY(size * k, C.navy, 600), lineHeight: 1.3, marginTop: data.health ? 1 * k : 2 * k }}>{data.ifYouSee}</Text>
    </View>
  );
}

/** "LAST SEEN  Wed, Nov 4  Sach'a Yuntas" on one line, centred or not. */
function LastSeen({ data, k, align = 'center', w }) {
  return (
    <Text style={{ ...CLAMP(1), ...BODY(12 * k, C.soft, 400), textAlign: align, width: w, lineHeight: 1.2 }}>
      <Text style={EYEBROW(8.25 * k)}>Last seen  </Text>
      <Text style={{ fontWeight: 700, color: C.navy }}>{data.lastSeenWhen}</Text>
      {data.lastSeenWhen ? '   ' : ''}
      {data.lastSeenArea}
    </Text>
  );
}

function Facts({ data, k, w, lines = 2, align = 'center' }) {
  return (
    <Text style={{ ...CLAMP(lines), ...BODY(12.75 * k), width: w, textAlign: align }}>
      {data.lookFor}
      {data.factsLine ? ` ${data.factsLine.replace(/ · /g, ', ')}.` : ''}
    </Text>
  );
}

/** Tear-off strip: 8 tabs with the phone and the name; 4 wider ones when they carry the short link instead. */
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
      <SheetGround w={page.w} h={page.h} cx={page.w / 2} cy={plan.top + plan.photo.h / 2} stripe={plan.stripe} foot={plan.foot} />
      <Print data={data} src={photoSrc} w={plan.photo.w} h={plan.photo.h} k={k} />
      <View style={{ marginTop: plan.gap }}>
        <Band size={plan.wordSize} color={data.accentBg || C.lost}>{data.stamp}</Band>
      </View>
      <Text style={{ ...CLAMP(1), ...NAME(fitInter(data.coverLine, contentW, 22 * k, 14 * k)), lineHeight: 1, textAlign: 'center', marginTop: plan.nameGap }}>{data.coverLine}</Text>
      <View style={{ marginTop: plan.rowGap, height: plan.row, flexDirection: 'row' }}>
        <MapTile data={data} w={plan.mapW} h={plan.row} k={k} />
        <View style={{ marginLeft: plan.rowGapX, width: contentW - plan.mapW - plan.rowGapX, height: plan.row }}>
          <Where data={data} k={k} w={contentW - plan.mapW - plan.rowGapX} lines={3} lookSize={10} />
        </View>
      </View>
      <Advice data={data} k={k} w={contentW} h={plan.advice} size={10.5} lines={3} marginTop={plan.adviceGap} />
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

/** One half sheet: the print beside the words. */
function Half({ data, plan, photoSrc, id, cut }) {
  const k = 0.8;
  const { pad, colX, detailsW } = plan;
  return (
    <View style={{ height: plan.halfH, position: 'relative', borderBottomWidth: cut ? 0.75 : 0, borderBottomColor: C.navy, borderBottomStyle: 'dashed' }}>
      <SheetGround w={PAGES.LETTER.w} h={plan.halfH} cx={pad + plan.photo.w / 2} cy={pad + plan.photo.h / 2} stripe={plan.stripe} id={id} />
      <View style={{ position: 'absolute', left: pad, top: pad }}>
        <Print data={data} src={photoSrc} w={plan.photo.w} h={plan.photo.h} k={k} />
      </View>
      <View style={{ position: 'absolute', left: colX, top: pad + 4, width: detailsW, height: plan.halfH - pad * 2 - 7 }}>
        <View style={{ alignItems: 'flex-start' }}>
          <Band size={plan.wordSize} color={data.accentBg || C.lost}>{data.stamp}</Band>
        </View>
        <Text style={{ ...CLAMP(1), ...NAME(fitInter(data.coverLine, detailsW, 19.5, 12)), marginTop: 5 }}>{data.coverLine}</Text>
        <View style={{ marginTop: 5 }}>
          <LastSeen data={data} k={k} align="left" w={detailsW} />
        </View>
        <View style={{ marginTop: 3 }}>
          <Facts data={data} k={k} w={detailsW} lines={2} align="left" />
        </View>
        <View style={{ marginTop: 5 }}>
          <MapTile data={data} w={detailsW} h={plan.mapH} k={k} />
        </View>
        <Advice data={data} k={k} w={detailsW} size={9} lines={2} marginTop={5} />
        <View style={{ flex: 1 }} />
        <ContactPanel data={data} w={detailsW} k={k} stacked phoneBase={28} />
      </View>
    </View>
  );
}

function HalfSheetPage({ data, plan, photoSrc }) {
  return (
    <Page size={[PAGES.LETTER.w, PAGES.LETTER.h]} style={{ backgroundColor: C.yellow, fontFamily: 'Inter', color: C.navy }}>
      <Half data={data} plan={plan} photoSrc={photoSrc} id="lit-a" cut />
      <Half data={data} plan={plan} photoSrc={photoSrc} id="lit-b" />
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
