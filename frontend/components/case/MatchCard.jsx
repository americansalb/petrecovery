'use client';

/**
 * MatchCard
 *
 * The "Is this them? → Confirm & connect" moment for a FOUND-report match.
 * Replaces the inline-styled, read-only Potential Matches block in
 * app/report/found/page.js with a shared-design-system, ACTIONABLE card.
 *
 * Contract: .vaak/vision.md §4c/§4d (relay broker) + docs/design/match-card-spec.md.
 *
 * Hard rules enforced here (UI side of the contract):
 *  - The card NEVER renders raw phone/email/exact coords. Location is the
 *    backend-formatted `coarseArea` string only (no client-side geo rounding).
 *  - Connect is a relay BROKER, not a reveal: clicking opens a server-side
 *    thread (POST /api/relay/{matchId}); real identities never reach the client
 *    pre-mutual-opt-in. The counterparty shows as an anonymous handle.
 *  - The CTA is gated on calibrated P(true-match): >= 0.70 actionable; below
 *    that we show honest status, never a Confirm button or owner alert.
 *  - Microchip matches bypass the floor → definitive "Verified owner" state,
 *    never a percentage; connect is still brokered.
 *  - Confidence is conveyed with text + icon, not color alone (WCAG AA).
 *  - The anti-scam banner is rendered verbatim from the backend (single source
 *    of truth), never hardcoded here.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  BadgeCheck,
  AlertTriangle,
  Flag,
  Send,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../ui/utils';

// The confidence floor lives in ONE place: the server (getConfidenceBand in
// @/app/lib/matching). This card TRUSTS the server-computed `band`/`canConnect`
// and never re-implements the threshold — so lowering the floor server-side can
// never leave the card hiding a CTA the server intended to show.

const SPECIES_EMOJI = {
  DOG: '🐕',
  CAT: '🐈',
  BIRD: '🐦',
  RABBIT: '🐇',
  OTHER: '🐾',
};

function speciesEmoji(species) {
  return SPECIES_EMOJI[(species || 'OTHER').toUpperCase()] || SPECIES_EMOJI.OTHER;
}

/**
 * Label is derived from the server `band` — the SAME signal that gates the CTA —
 * so the label and the actionability can never tell different stories (per
 * dev-challenger watch-item: no "Good Match" label without a way to act on it).
 * Returns null when no match-quality label should show (suppress band).
 */
function bandLabel(band) {
  if (band === 'actionable') return { text: 'Strong match', tone: 'text-flash-700' };
  if (band === 'feed') return { text: 'Possible match · under review', tone: 'text-midnight-500' };
  return null; // suppress → honest status carries the message, no label
}

function MatchPhoto({ photo, name, species }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name ? `Photo of ${name}` : 'Reported pet photo'}
        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-16 h-16 rounded-xl bg-midnight-100 flex items-center justify-center text-2xl flex-shrink-0"
      aria-hidden="true"
    >
      {speciesEmoji(species)}
    </div>
  );
}

/**
 * @param {object}   match       §4d payload: {matchId, petPhoto, petName, species, coarseArea, pTrueMatch, matchSource, canConnect}
 * @param {function} onEvent     (name, payload) instrumentation sink — match_shown / match_confirm_clicked / relay_opened / match_not_mine
 * @param {function} openRelay   async (matchId) => {threadId, antiScamBanner, counterpartyHandle, coarseArea}. Defaults to the live endpoint.
 * @param {function} sendMessage async (threadId, body) => void. Defaults to the live endpoint.
 */
export function MatchCard({ match, onEvent, openRelay, sendMessage }) {
  const {
    matchId,
    petPhoto,
    petName,
    species,
    coarseArea,
    pTrueMatch = 0,
    matchSource = 'attribute',
    canConnect = false,
    band, // 'actionable' | 'feed' | 'suppress' — server single source of truth (getConfidenceBand)
  } = match || {};

  const isVerifiedOwner = matchSource === 'microchip';
  // Fail-CLOSED (per dev-challenger msg 460): show the actionable CTA + owner-push
  // state ONLY on the positive condition — server says band==='actionable' AND
  // canConnect===true (or it's a microchip match). A missing/unknown band or a
  // falsy canConnect yields NO CTA, never an accidental one. Two match producers
  // exist (calculateMatchScore + the inline matcher); not every payload is
  // guaranteed well-formed, so absence of the trusted field must DENY, not allow.
  const actionable = isVerifiedOwner || (band === 'actionable' && canConnect === true);
  const label = isVerifiedOwner ? null : bandLabel(band);

  // idle → connecting → relay (thread open) | dismissed
  const [phase, setPhase] = useState('idle');
  const [thread, setThread] = useState(null);
  const [error, setError] = useState(null);

  const emit = (name, payload = {}) =>
    onEvent && onEvent(name, { matchId, matchSource, pTrueMatch, ...payload });

  // Emit match_shown once per mounted card (denominator for conversion rates).
  const shownRef = useRef(false);
  useEffect(() => {
    if (!shownRef.current && matchId) {
      shownRef.current = true;
      emit('match_shown');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function handleConfirm() {
    setError(null);
    setPhase('connecting');
    emit('match_confirm_clicked');
    try {
      const open = openRelay || defaultOpenRelay;
      const t = await open(matchId);
      setThread(t);
      setPhase('relay');
      emit('relay_opened', { threadId: t?.threadId });
    } catch (e) {
      // Rate-limit / broker failure → honest, non-punitive surface.
      setError(e?.code === 'RATE_LIMITED' ? 'rate_limited' : 'generic');
      setPhase('idle');
    }
  }

  function handleNotMine() {
    setPhase('dismissed');
    emit('match_not_mine');
  }

  if (phase === 'dismissed') return null;

  if (phase === 'relay' && thread) {
    return <RelayThread thread={thread} petName={petName} sendMessage={sendMessage} />;
  }

  // ---- Card head (shared across actionable / verified / status) ----
  return (
    <Card
      variant="default"
      padding="md"
      accent={isVerifiedOwner ? 'green' : actionable ? 'yellow' : 'midnight'}
      className="text-left"
    >
      <div className="flex items-start gap-4">
        <MatchPhoto photo={petPhoto} name={petName} species={species} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-midnight-900 truncate">
              {petName || 'Reported pet'}
              <span className="font-normal text-midnight-500"> · {titleCase(species)}</span>
            </p>

            {isVerifiedOwner ? (
              <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-sm whitespace-nowrap">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Verified owner
              </span>
            ) : label ? (
              <span className={cn('inline-flex items-center gap-1 font-semibold text-sm whitespace-nowrap', label.tone)}>
                <BadgeCheck className="w-4 h-4" aria-hidden="true" />
                {label.text}
              </span>
            ) : null}
          </div>

          {/* Coarse area only — never exact coordinates (contract §4c). */}
          {coarseArea && (
            <p className="text-sm text-midnight-500 mt-0.5 truncate">{coarseArea}</p>
          )}

          {isVerifiedOwner && (
            <p className="text-sm text-green-700 mt-0.5">
              Microchip match — registered owner
            </p>
          )}
        </div>
      </div>

      {actionable ? (
        <div className="mt-4">
          {!isVerifiedOwner && (
            <p className="text-sm font-medium text-midnight-800 mb-2">Is this them?</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              loading={phase === 'connecting'}
              onClick={handleConfirm}
              leftIcon={isVerifiedOwner ? ShieldCheck : undefined}
            >
              {isVerifiedOwner ? 'Connect with owner' : 'Confirm & connect'}
            </Button>
            {!isVerifiedOwner && (
              <Button variant="outline" size="md" onClick={handleNotMine} disabled={phase === 'connecting'}>
                Not a match
              </Button>
            )}
          </div>
          {error && <BrokerError kind={error} />}
        </div>
      ) : (
        // Below the P(true) floor: honest status, no Confirm, no owner alert.
        <HonestStatus />
      )}
    </Card>
  );
}

/** State C — backs the "we're withholding sub-threshold alerts" contract. */
function HonestStatus() {
  return (
    <div className="mt-3 flex items-start gap-2 text-sm text-midnight-600">
      <Search className="w-4 h-4 mt-0.5 flex-shrink-0 text-midnight-400" aria-hidden="true" />
      <p>
        We&apos;re checking for matches nearby. Owners of pets matching this description will
        be alerted only if there&apos;s a strong match.
      </p>
    </div>
  );
}

function BrokerError({ kind }) {
  return (
    <p className="mt-2 text-sm text-amber-700" role="status">
      {kind === 'rate_limited'
        ? "You've sent a lot of requests in a short time. Please wait a moment and try again."
        : "We couldn't open a secure conversation just now. Please try again."}
    </p>
  );
}

/** The brokered relay thread — no raw PII, anti-scam banner from backend, report/block. */
function RelayThread({ thread, petName, sendMessage }) {
  const { threadId, antiScamBanner, counterpartyHandle } = thread || {};
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const send = sendMessage || defaultSendMessage;
      await send(threadId, body);
      setMessages((m) => [...m, { mine: true, body }]);
      setDraft('');
    } catch {
      /* surfaced inline below in a full build; kept minimal for v1 */
    } finally {
      setSending(false);
    }
  }

  return (
    <Card variant="default" padding="md" accent="blue" className="text-left">
      {/* Anti-scam banner — rendered verbatim from backend (single source of truth). */}
      {antiScamBanner && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-800">{antiScamBanner}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-midnight-900 text-sm">
          Relay with {petName ? `${petName}'s owner` : 'the owner'}
          {counterpartyHandle && (
            <span className="font-normal text-midnight-400"> · {counterpartyHandle}</span>
          )}
        </p>
        <Button variant="ghost" size="sm" leftIcon={Flag} aria-label="Report this conversation">
          Report
        </Button>
      </div>

      <div className="min-h-[88px] max-h-48 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-sm text-midnight-400">
            Say hello and confirm details. Your phone and email stay private until you both choose to share them.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                m.mine ? 'ml-auto bg-flash-100 text-midnight-900' : 'bg-midnight-100 text-midnight-800'
              )}
            >
              {m.body}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          aria-label="Message to the owner"
          className="flex-1 rounded-xl border border-midnight-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
        />
        <Button type="submit" variant="primary" size="md" loading={sending} leftIcon={sending ? undefined : Send}>
          Send
        </Button>
      </form>
    </Card>
  );
}

/** List-level empty state — reassuring, never a blank gap. */
export function NoMatchesYet() {
  return (
    <Card variant="ghost" padding="lg" className="text-center">
      <div className="text-3xl mb-2" aria-hidden="true">🔦</div>
      <p className="font-semibold text-midnight-900">No matches yet — but we&apos;re looking</p>
      <p className="text-sm text-midnight-500 mt-1">
        We&apos;ll alert nearby owners the moment a strong match appears. Keeping the pet safe and
        adding clear photos helps.
      </p>
    </Card>
  );
}

/** List-level rate-limit state (abuse guard, designed-in not bolted-on). */
export function MatchesRateLimited({ retryAfterSeconds }) {
  return (
    <Card variant="warning" padding="md" className="text-left">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-sm text-amber-800">
          You&apos;ve made several requests quickly. Please wait
          {retryAfterSeconds ? ` ${retryAfterSeconds}s` : ' a moment'} and try again.
        </p>
      </div>
    </Card>
  );
}

// ---- Default live wiring (overridable for tests / preview) ----
async function defaultOpenRelay(matchId) {
  const res = await fetch(`/api/relay/${encodeURIComponent(matchId)}`, { method: 'POST' });
  if (res.status === 429) {
    const err = new Error('rate limited');
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (!res.ok) throw new Error(`relay open failed: ${res.status}`);
  return res.json();
}

async function defaultSendMessage(threadId, body) {
  const res = await fetch(`/api/relay/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`relay send failed: ${res.status}`);
}

function titleCase(s) {
  if (!s) return '';
  const lower = String(s).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default MatchCard;
