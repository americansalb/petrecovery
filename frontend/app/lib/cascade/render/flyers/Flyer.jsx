import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { FLYER_THEME as T, PAGE } from './theme';

/**
 * Best-in-class, emotionally irresistible lost-pet flyers. Three layouts,
 * one normalized `data`. The lever for "a stranger cannot scroll past" is the
 * pet's photo as hero + the pet's own first-person plea + the family waiting.
 *  - classic : full Letter poster (photo hero, plea, family line, ID, approach, CTA)
 *  - tabs    : Letter with tear-off phone tabs along the bottom
 *  - poster  : 11x17 pole/yard poster, readable from across a street
 */

function PhotoOrBlock({ src, style, label, blockLabelSize = 44 }) {
  if (src) return <Image src={src} style={[style, { objectFit: 'cover' }]} />;
  return (
    <View style={[style, { backgroundColor: T.midnight, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: blockLabelSize, letterSpacing: 2 }}>{label}</Text>
      <Text style={{ color: T.flash, fontWeight: 700, fontSize: blockLabelSize * 0.3, marginTop: 6 }}>
        photo coming soon
      </Text>
    </View>
  );
}

/** Photo hero with a dark scrim + the headline set on the image itself. */
function PhotoHero({ data, height, headlineSize }) {
  return (
    <View style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <PhotoOrBlock src={data.photos[0]} label={data.speciesLabel} blockLabelSize={height * 0.2}
        style={{ width: '100%', height }} />
      {/* scrim */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.42, backgroundColor: T.midnight, opacity: 0.62 }} />
      {/* headline on the photo */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: headlineSize, letterSpacing: -0.5, flex: 1 }}>{data.headline}</Text>
        <View style={{ backgroundColor: data.accentBg, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 10 }}>
          <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>{data.stamp} {data.speciesLabel}</Text>
        </View>
      </View>
      {data.reward ? (
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <RewardBadge data={data} />
        </View>
      ) : null}
    </View>
  );
}

function RewardBadge({ data, size = 'md' }) {
  if (!data.reward) return null;
  const big = size === 'lg';
  return (
    <View style={{ backgroundColor: T.flash, borderWidth: big ? 3 : 2, borderColor: '#a16207', borderRadius: 8, paddingVertical: big ? 10 : 6, paddingHorizontal: big ? 20 : 13, alignItems: 'center' }}>
      <Text style={{ fontSize: big ? 14 : 8.5, fontWeight: 700, color: '#854d0e', letterSpacing: 1 }}>REWARD</Text>
      <Text style={{ fontSize: big ? 34 : 20, fontWeight: 900, color: '#713f12', marginTop: 1 }}>{data.reward}</Text>
    </View>
  );
}

function IdRow({ data, small }) {
  const fs = small ? 8 : 9;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
      {data.chips.map((c, i) => (
        <Text key={i} style={{ fontSize: 11, color: T.slate, fontWeight: 600, marginRight: 12 }}>{c}</Text>
      ))}
      {data.microchipped ? (
        <View style={{ backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 7, marginRight: 6 }}>
          <Text style={{ fontSize: fs, fontWeight: 700, color: '#166534' }}>✓ Microchipped</Text>
        </View>
      ) : null}
    </View>
  );
}

function LookFor({ data }) {
  if (!data.markings) return null;
  return (
    <View style={{ marginTop: 9, flexDirection: 'row' }}>
      <Text style={{ fontSize: 11, fontWeight: 900, color: T.accent, marginRight: 6 }}>LOOK FOR:</Text>
      <Text style={{ fontSize: 11, fontWeight: 600, color: T.midnight, flex: 1, lineHeight: 1.4 }}>{data.markings}</Text>
    </View>
  );
}

function ApproachBox({ data, compact }) {
  return (
    <View style={{ marginTop: compact ? 8 : 11, backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: T.flash, borderRadius: 4, padding: compact ? 7 : 9, flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
        <Text style={{ fontSize: 11, fontWeight: 900, color: '#ffffff' }}>!</Text>
      </View>
      <Text style={{ fontSize: compact ? 9.5 : 10.5, color: T.slate, lineHeight: 1.45, flex: 1 }}>{data.approachLine}</Text>
    </View>
  );
}

/** The high-contrast foot: turns the pang into a call, a scan, or a share. */
function CtaFooter({ data, big }) {
  return (
    <View style={{ marginTop: big ? 14 : 12, backgroundColor: '#f1f5f9', borderRadius: 10, padding: big ? 16 : 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: big ? 12 : 10, color: T.mute, fontWeight: 700, letterSpacing: 1 }}>{data.contactVerb}</Text>
          <Text style={{ fontWeight: 900, color: T.accent, fontSize: big ? 40 : 28 }}>{data.contactValue}</Text>
          {data.contactSecondary ? <Text style={{ fontSize: 10, color: T.mute, marginTop: 1 }}>{data.contactSecondary}</Text> : null}
        </View>
        {data.qrDataUrl ? (
          <View style={{ alignItems: 'center', width: (big ? 108 : 96) }}>
            <Image src={data.qrDataUrl} style={{ width: big ? 96 : 84, height: big ? 96 : 84, borderWidth: 4, borderColor: T.midnight, borderRadius: 6 }} />
            <Text style={{ fontSize: 7.5, color: T.mute, marginTop: 3, textAlign: 'center', fontWeight: 600, lineHeight: 1.25 }}>{data.scanCta}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: big ? 11.5 : 10, color: T.midnight, fontWeight: 700, textAlign: 'center', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
        {data.shareNudge}
        <Text style={{ fontWeight: 400, color: T.faint }}>{'   '}Posted free via ReunitePets.org · Case {data.caseNumber}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', backgroundColor: T.paper, padding: 0 },
  body: { paddingHorizontal: 30, paddingTop: 18, paddingBottom: 18, flexGrow: 1 },
  plea: { fontSize: 14, color: T.midnight, fontWeight: 600, lineHeight: 1.45, marginTop: 13 },
  family: { fontSize: 11, color: T.mute, marginTop: 6, lineHeight: 1.4 },
  metaRow: { flexDirection: 'row', marginTop: 10 },
  metaLabel: { fontSize: 8, color: T.faint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  metaValue: { fontSize: 11.5, color: T.midnight, fontWeight: 700, marginTop: 2 },
  footer: { marginTop: 'auto', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontWeight: 900, color: T.midnight, letterSpacing: -0.5 },
  chip: { fontSize: 11, color: T.slate, fontWeight: 600, marginRight: 12 },
});

function ClassicLetter({ data }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.body}>
        <PhotoHero data={data} height={262} headlineSize={25} />
        <Text style={s.plea}>{data.plea}</Text>
        <Text style={s.family}>{data.familyLine}</Text>
        <IdRow data={data} />
        <LookFor data={data} />
        <ApproachBox data={data} />
        <View style={s.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>Last seen</Text>
            <Text style={s.metaValue}>{data.lastSeenArea}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>When</Text>
            <Text style={s.metaValue}>{data.lastSeenWhen}</Text>
          </View>
        </View>
        <CtaFooter data={data} big />
      </View>
    </Page>
  );
}

function TearTabFlyer({ data }) {
  const tabs = Array.from({ length: 8 });
  return (
    <Page size="LETTER" style={s.page}>
      <View style={[s.body, { paddingBottom: 10 }]}>
        <View style={{ flexDirection: 'row' }}>
          <PhotoOrBlock src={data.photos[0]} label={data.speciesLabel} blockLabelSize={34}
            style={{ width: 200, height: 200, borderRadius: 8 }} />
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[s.name, { fontSize: 24, flex: 1 }]}>{data.headline}</Text>
              {data.reward ? <RewardBadge data={data} /> : null}
            </View>
            <Text style={{ fontSize: 12.5, color: T.midnight, fontWeight: 600, lineHeight: 1.45, marginTop: 8 }}>{data.plea}</Text>
            <IdRow data={data} small />
          </View>
        </View>
        <LookFor data={data} />
        <ApproachBox data={data} compact />
        <Text style={[s.metaLabel, { marginTop: 10 }]}>Last seen</Text>
        <Text style={s.metaValue}>{data.lastSeenArea} · {data.lastSeenWhen}</Text>
        <CtaFooter data={data} />

        <View style={{ flexDirection: 'row', marginTop: 'auto', borderTopWidth: 1, borderTopColor: T.hair, borderTopStyle: 'dashed', paddingTop: 4 }}>
          {tabs.map((_, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: i < 7 ? 1 : 0, borderRightColor: T.hair, borderRightStyle: 'dashed' }}>
              <Text style={{ fontSize: 6.5, color: T.mute, fontWeight: 700 }}>FIND {data.petName.toUpperCase()}</Text>
              <Text style={{ fontSize: 8.5, color: T.midnight, fontWeight: 700, marginTop: 3 }}>{data.contactValue}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function YardPoster({ data }) {
  return (
    <Page size={[PAGE.TABLOID.width, PAGE.TABLOID.height]} style={s.page}>
      <View style={{ paddingHorizontal: 46, paddingTop: 40, paddingBottom: 34, flexGrow: 1 }}>
        <PhotoHero data={data} height={620} headlineSize={58} />
        <Text style={{ fontSize: 26, color: T.midnight, fontWeight: 600, lineHeight: 1.4, marginTop: 22, textAlign: 'center' }}>{data.plea}</Text>
        <Text style={{ fontSize: 17, color: T.mute, textAlign: 'center', marginTop: 8 }}>
          {data.chips.join('  •  ')}{data.microchipped ? '  •  ✓ Microchipped' : ''}
        </Text>
        {data.markings ? (
          <Text style={{ fontSize: 18, color: T.midnight, fontWeight: 700, textAlign: 'center', marginTop: 10 }}>Look for: {data.markings}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 26 }}>
          {data.qrDataUrl ? (
            <View style={{ alignItems: 'center', marginRight: 30 }}>
              <Image src={data.qrDataUrl} style={{ width: 150, height: 150, borderWidth: 5, borderColor: T.midnight, borderRadius: 8 }} />
              <Text style={{ fontSize: 12, color: T.mute, marginTop: 5, fontWeight: 600 }}>Scan for more</Text>
            </View>
          ) : null}
          <View>
            <Text style={{ fontSize: 15, color: T.mute, fontWeight: 700, letterSpacing: 1 }}>{data.contactVerb}</Text>
            <Text style={{ fontWeight: 900, color: T.accent, fontSize: 52 }}>{data.contactValue}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, color: T.midnight, fontWeight: 700, textAlign: 'center', marginTop: 20 }}>{data.shareNudge}</Text>
        <Text style={{ fontSize: 13, color: T.faint, textAlign: 'center', marginTop: 'auto' }}>
          Last seen {data.lastSeenArea} • {data.lastSeenWhen} • Posted free via ReunitePets.org • Case {data.caseNumber}
        </Text>
      </View>
    </Page>
  );
}

const VARIANTS = { classic: ClassicLetter, tabs: TearTabFlyer, poster: YardPoster };

export function FlyerDocument({ data, variant = 'classic' }) {
  const Variant = VARIANTS[variant] || ClassicLetter;
  return (
    <Document title={`${data.stamp} ${data.petName} — ${data.caseNumber}`} author="ReunitePets">
      <Variant data={data} />
    </Document>
  );
}
