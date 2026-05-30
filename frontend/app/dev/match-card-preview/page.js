'use client';

/**
 * DEV PREVIEW — Match Card states.
 * Clickable review artifact for docs/design/match-card-spec.md + vision.md §4c/§4d.
 * Mock relay handlers (no backend needed) so the Confirm → relay flow works end-to-end.
 * Not linked from the app; remove or gate before production.
 */

import { useState } from 'react';
import { MatchCard, NoMatchesYet, MatchesRateLimited } from '../../../components/case/MatchCard';

// Mock relay broker — mirrors the §4d contract shape; exposes NO raw PII.
async function mockOpenRelay(matchId) {
  await new Promise((r) => setTimeout(r, 500));
  return {
    threadId: `thread_${matchId}`,
    counterpartyHandle: 'Owner · anon-7f3',
    coarseArea: 'Near Eastside · ~1km',
    antiScamBanner:
      'ReunitePets never asks for payment or a reward to reconnect you with a pet. Report anyone who does.',
  };
}
async function mockSend() {
  await new Promise((r) => setTimeout(r, 300));
}

const SAMPLES = {
  actionable: {
    matchId: 'm1',
    petPhoto: '',
    petName: 'Max',
    species: 'DOG',
    coarseArea: 'Near Eastside · ~1km',
    pTrueMatch: 0.82,
    matchSource: 'visual',
    band: 'actionable',
    canConnect: true,
  },
  verified: {
    matchId: 'm2',
    petPhoto: '',
    petName: 'Bella',
    species: 'CAT',
    coarseArea: 'Near Riverside · ~1km',
    pTrueMatch: 1.0,
    matchSource: 'microchip',
    band: 'actionable',
    canConnect: true,
  },
  feed: {
    matchId: 'm3',
    petPhoto: '',
    petName: 'Unknown',
    species: 'DOG',
    coarseArea: 'Near Downtown · ~2km',
    pTrueMatch: 0.55,
    matchSource: 'attribute',
    band: 'feed',
    canConnect: false,
  },
  suppress: {
    matchId: 'm4',
    petPhoto: '',
    petName: 'Unknown',
    species: 'CAT',
    coarseArea: 'Near Midtown · ~3km',
    pTrueMatch: 0.3,
    matchSource: 'attribute',
    band: 'suppress',
    canConnect: false,
  },
  // Fail-safe: a malformed/legacy payload (canConnect true but NO band) must NOT
  // surface a CTA — absence of the trusted field denies, never allows.
  malformed: {
    matchId: 'm5',
    petPhoto: '',
    petName: 'Unknown',
    species: 'DOG',
    coarseArea: 'Near Westend · ~2km',
    pTrueMatch: 0.9,
    matchSource: 'attribute',
    canConnect: true, // truthy, but band is undefined → fail-closed → no CTA
  },
};

function Section({ title, note, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', marginBottom: 4 }}>
        {title}
      </h2>
      {note && <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 10 }}>{note}</p>}
      <div style={{ maxWidth: 480 }}>{children}</div>
    </section>
  );
}

export default function MatchCardPreview() {
  const [events, setEvents] = useState([]);
  const onEvent = (name, payload) =>
    setEvents((e) => [{ name, payload, t: e.length }, ...e].slice(0, 20));

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Match Card — preview</h1>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Confirm-&amp;-Connect on the existing FOUND match. Relay-brokered (no PII), P(true)-gated CTA,
          microchip → verified-owner. Spec: docs/design/match-card-spec.md.
        </p>

        <Section title="Actionable (visual, P(true)=0.82)" note="Click Confirm & connect → opens a brokered relay thread (mock).">
          <MatchCard match={SAMPLES.actionable} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Verified owner (microchip)" note="Bypasses the floor; definitive state, never a %.">
          <MatchCard match={SAMPLES.verified} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Feed band (0.40–0.70)" note="'Possible match · under review' label, NO Confirm, NO owner alert — label matches actionability.">
          <MatchCard match={SAMPLES.feed} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Suppress band (<0.40)" note="No match label at all; honest status carries the message.">
          <MatchCard match={SAMPLES.suppress} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Malformed payload (fail-closed)" note="canConnect:true but band undefined → NO CTA. Absence of the trusted field denies, never allows.">
          <MatchCard match={SAMPLES.malformed} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Actionable, relay not live yet (connectAvailable=false)" note="Interim state on report/found until the relay broker activates: truthful 'owner alerted' note, no dead CTA. This is what ships now.">
          <MatchCard match={SAMPLES.actionable} connectAvailable={false} onEvent={onEvent} openRelay={mockOpenRelay} sendMessage={mockSend} />
        </Section>

        <Section title="Empty — no matches yet">
          <NoMatchesYet />
        </Section>

        <Section title="Rate limited (abuse guard)">
          <MatchesRateLimited retryAfterSeconds={30} />
        </Section>

        <Section title="Instrumentation events (full-chain, rate denominators)" note="match_shown → match_confirm_clicked → relay_opened / match_not_mine.">
          <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: 12, fontSize: '0.8rem', overflow: 'auto' }}>
            {events.length === 0 ? 'Interact above to emit events…' : events.map((e, i) => `${e.name} ${JSON.stringify(e.payload)}`).join('\n')}
          </pre>
        </Section>
      </div>
    </div>
  );
}
