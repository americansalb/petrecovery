import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { FLYER_THEME as T, PAGE, SPECIES_LABEL } from './theme';

/**
 * Three print-ready flyer layouts, all fed by the same normalized `data`.
 * No photo → a branded species block. `variant`: 'classic' | 'tabs' | 'poster'.
 */

function PhotoOrBlock({ data, style, blockLabelSize = 44 }) {
  if (data.photoDataUrl) {
    return <Image src={data.photoDataUrl} style={[style, { objectFit: 'cover' }]} />;
  }
  return (
    <View style={[style, { backgroundColor: T.midnight, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#ffffff', fontWeight: 900, fontSize: blockLabelSize, letterSpacing: 2 }}>
        {data.speciesLabel}
      </Text>
      <Text style={{ color: T.flash, fontWeight: 700, fontSize: blockLabelSize * 0.32, marginTop: 6 }}>
        photo coming soon
      </Text>
    </View>
  );
}

function TearTabs({ data }) {
  const tabs = Array.from({ length: 8 });
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: T.hair,
        borderTopStyle: 'dashed',
        marginTop: 'auto',
      }}
    >
      {tabs.map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 2,
            alignItems: 'center',
            borderRightWidth: i < tabs.length - 1 ? 1 : 0,
            borderRightColor: T.hair,
            borderRightStyle: 'dashed',
          }}
        >
          <Text style={{ fontSize: 7, color: T.mute, fontWeight: 700 }}>
            {data.stamp} {data.petName.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 9, color: T.midnight, fontWeight: 700, marginTop: 3 }}>
            {data.contactValue}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', backgroundColor: T.paper, padding: 0 },
  banner: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  bannerTitle: { color: '#ffffff', fontWeight: 900, letterSpacing: 1 },
  body: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 24, flexGrow: 1 },
  name: { fontWeight: 900, color: T.midnight, letterSpacing: -0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  chip: { fontSize: 11, color: T.slate, fontWeight: 600, marginRight: 12 },
  desc: { fontSize: 12, color: T.slate, lineHeight: 1.5, marginTop: 12 },
  metaRow: { flexDirection: 'row', marginTop: 14 },
  metaLabel: { fontSize: 8, color: T.faint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  metaValue: { fontSize: 12, color: T.midnight, fontWeight: 600, marginTop: 2 },
  reward: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#fef9c3',
    borderWidth: 1,
    borderColor: '#fde047',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rewardText: { fontSize: 12, fontWeight: 900, color: '#854d0e' },
  contactRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  callBox: { flexShrink: 1 },
  callLabel: { fontSize: 10, color: T.mute, fontWeight: 700, letterSpacing: 1 },
  callValue: { fontWeight: 900, color: T.accent },
  qrWrap: { alignItems: 'center' },
  qr: { borderWidth: 4, borderColor: T.midnight, borderRadius: 6 },
  qrCaption: { fontSize: 7, color: T.mute, marginTop: 3, textAlign: 'center' },
});

function ClassicLetter({ data }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={[s.banner, { backgroundColor: data.accentBg }]}>
        <Text style={[s.bannerTitle, { fontSize: 40 }]}>{data.stamp} {data.speciesLabel}</Text>
        <Text style={{ color: '#ffffff', fontWeight: 700, fontSize: 12, opacity: 0.85 }}>
          Case {data.caseNumber}
        </Text>
      </View>
      <View style={s.body}>
        <PhotoOrBlock data={data} style={{ width: '100%', height: 300, borderRadius: 8 }} blockLabelSize={54} />
        <Text style={[s.name, { fontSize: 40, marginTop: 16 }]}>{data.petName}</Text>
        <View style={s.chips}>
          {data.chips.map((c, i) => (
            <Text key={i} style={s.chip}>{c}</Text>
          ))}
        </View>
        {data.description ? <Text style={s.desc}>{data.description}</Text> : null}
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
        {data.reward ? (
          <View style={s.reward}>
            <Text style={s.rewardText}>{data.reward}</Text>
          </View>
        ) : null}
        <View style={s.contactRow}>
          <View style={s.callBox}>
            <Text style={s.callLabel}>{data.contactVerb}</Text>
            <Text style={[s.callValue, { fontSize: 26 }]}>{data.contactValue}</Text>
            {data.contactSecondary ? (
              <Text style={{ fontSize: 11, color: T.mute, marginTop: 2 }}>{data.contactSecondary}</Text>
            ) : null}
          </View>
          {data.qrDataUrl ? (
            <View style={s.qrWrap}>
              <Image src={data.qrDataUrl} style={[s.qr, { width: 96, height: 96 }]} />
              <Text style={s.qrCaption}>Scan for photos{'\n'}& live updates</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

function TearTabFlyer({ data }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={[s.banner, { backgroundColor: data.accentBg, paddingVertical: 14 }]}>
        <Text style={[s.bannerTitle, { fontSize: 34 }]}>{data.stamp} {data.speciesLabel}</Text>
        <Text style={{ color: '#ffffff', fontWeight: 700, fontSize: 11, opacity: 0.85 }}>Have you seen {data.petName}?</Text>
      </View>
      <View style={[s.body, { paddingTop: 14, paddingBottom: 8 }]}>
        <View style={{ flexDirection: 'row' }}>
          <PhotoOrBlock data={data} style={{ width: 200, height: 200, borderRadius: 8 }} blockLabelSize={34} />
          <View style={{ flex: 1, paddingLeft: 18 }}>
            <Text style={[s.name, { fontSize: 34 }]}>{data.petName}</Text>
            <View style={[s.chips, { marginTop: 8 }]}>
              {data.chips.map((c, i) => (
                <Text key={i} style={s.chip}>{c}</Text>
              ))}
            </View>
            {data.description ? <Text style={[s.desc, { marginTop: 10 }]}>{data.description}</Text> : null}
            <Text style={[s.metaLabel, { marginTop: 12 }]}>Last seen</Text>
            <Text style={s.metaValue}>{data.lastSeenArea}</Text>
            {data.reward ? (
              <View style={[s.reward, { marginTop: 10 }]}>
                <Text style={s.rewardText}>{data.reward}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={[s.contactRow, { marginTop: 14 }]}>
          <View style={s.callBox}>
            <Text style={s.callLabel}>{data.contactVerb}</Text>
            <Text style={[s.callValue, { fontSize: 24 }]}>{data.contactValue}</Text>
          </View>
          {data.qrDataUrl ? (
            <View style={s.qrWrap}>
              <Image src={data.qrDataUrl} style={[s.qr, { width: 84, height: 84 }]} />
              <Text style={s.qrCaption}>Scan for more</Text>
            </View>
          ) : null}
        </View>
        <TearTabs data={data} />
      </View>
    </Page>
  );
}

function YardPoster({ data }) {
  return (
    <Page size={[PAGE.TABLOID.width, PAGE.TABLOID.height]} style={s.page}>
      <View style={[s.banner, { backgroundColor: data.accentBg, paddingVertical: 34, justifyContent: 'center' }]}>
        <Text style={[s.bannerTitle, { fontSize: 92, letterSpacing: 2 }]}>{data.stamp} {data.speciesLabel}</Text>
      </View>
      <View style={{ paddingHorizontal: 44, paddingTop: 28, paddingBottom: 36, flexGrow: 1 }}>
        <PhotoOrBlock data={data} style={{ width: '100%', height: 560, borderRadius: 10 }} blockLabelSize={96} />
        <Text style={[s.name, { fontSize: 76, marginTop: 22, textAlign: 'center' }]}>{data.petName}</Text>
        <Text style={{ fontSize: 22, color: T.slate, fontWeight: 600, textAlign: 'center', marginTop: 6 }}>
          {data.chips.join('  •  ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
          {data.qrDataUrl ? <Image src={data.qrDataUrl} style={[s.qr, { width: 150, height: 150, marginRight: 28 }]} /> : null}
          <View>
            <Text style={{ fontSize: 18, color: T.mute, fontWeight: 700, letterSpacing: 1 }}>{data.contactVerb}</Text>
            <Text style={{ fontWeight: 900, color: data.accent, fontSize: 54 }}>{data.contactValue}</Text>
            {data.reward ? <Text style={[s.rewardText, { fontSize: 22, marginTop: 8 }]}>{data.reward}</Text> : null}
          </View>
        </View>
        <Text style={{ fontSize: 13, color: T.faint, textAlign: 'center', marginTop: 'auto' }}>
          Last seen {data.lastSeenArea} • {data.lastSeenWhen} • Case {data.caseNumber} • ReunitePets.org
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
