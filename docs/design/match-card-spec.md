# Match Card — Design Spec (v1)

**Owner:** UI Architect · **Status:** Partially shipped (see Implementation Status) · **Contract:** `.vaak/vision.md §4c/§4d` (relay/connect broker)
**Surface:** `frontend/app/report/found/page.js` (FOUND success → Potential Matches) and the future no-signup finder flow.

## Implementation Status (live)
- ✅ **MatchCard component** — `components/case/MatchCard.jsx`, on shared Card/Button/tokens. Gating + label in pure `components/case/matchGating.js` (fail-closed: CTA only on `band==='actionable' && canConnect===true`, or microchip). Verified at 200 on `/dev/match-card-preview`.
- ✅ **Fail-closed CI test** — `__tests__/components/match-gating.test.js` (9 cases): missing/garbage band ⇒ no CTA. Locks the security invariant.
- ✅ **report/found success matches** — wired to the §4d shape via an **inline** render (PII-free: petName + coarseArea only; band-derived Strong/Possible label; truthful "owner alerted" for actionable per the CORR-3 cruelty gate). Fixes the blank-match regression from the §4d contract change.
- ⏳ **Full `<MatchCard>` import into report/found** — DEFERRED. Adding the import to that large page tripped the dev webpack-cache flake (`reading 'call'`); MatchCard itself is fine (preview = 200). Re-attempt on a clean build (fresh `.next`).
- ⏳ **Live Confirm-&-Connect CTA** — gated on `connectAvailable`; shows the "owner alerted" interim until the relay broker tables are activated (architect's `MatchConnection`/`RelayMessage` + manual CREATE-TABLE SQL, not a `db push`). Endpoints exist at `/api/relay/{token}`; `openRelay`/`sendMessage` are overridable for the live swap.
- ⏳ **RelayThread owner-reply poll** — needs `GET /api/relay/{token}` wired at integration time.

This spec defines the visual states, data contract, and component decomposition for the match card. It is the front-half of Phase-2 (REACH + ACT) pulled forward to ride alongside existing-loop instrumentation: it turns the **passive** match list ("owners have been notified") into an **actionable, relay-brokered** Confirm-&-Connect moment — and instruments the `matched → contacted → reunited` drop-off.

---

## 1. Current state (what ships today)

`potentialMatches[]` from the create-found-report response, each:
`{ petPhoto, petName, petBreed, petColor, petSpecies, distance, matchQuality: 'high'|'medium'|'low', matchScore }`

Rendered as a read-only list. Problems:
- **No action.** Finder is holding the animal; the card only says owners were notified. The single highest-value action (confirm + connect) is absent.
- **Leaks precision.** Shows `distance.toFixed(1)` miles — finer than the §4c coarse-area rule allows for a pre-verification anonymous finder.
- **Inline styles + local `theme`** — not on the shared design system (Button/Card/tokens). Design-system drift.
- **Color-only quality signal** (amber/gray borders) — fails WCAG AA without a text/icon equivalent.

---

## 2. Target data contract (UI-driven; pair with @architect §4c)

Per the broker contract, the **finder pre-verification** payload must be coarse and PII-free:

| Field | Type | Notes |
|---|---|---|
| `matchId` | string | opaque; used to open a relay thread, never exposes case/owner id |
| `petPhoto` | url | owner's lost-pet photo |
| `petName`, `species` | string | identity-confirmation only |
| `coarseArea` | string | e.g. "Near Eastside, ~1km" — **snapped, never pinpoint** |
| `confidence` | number 0–1 | drives honest rendering (see §4) |
| `matchSource` | `'microchip' \| 'visual' \| 'attribute'` | microchip → **verified-owner** state |
| `antiScamBanner` | string | **backend-authored** copy (single source of truth) |
| `canConnect` | bool | false when below confidence floor → card shows honest-status instead |

Exact coords + contact are **never** in this payload — they unlock only post-mutual-opt-in inside the relay thread.

---

## 3. State mocks

**A. Actionable match (attribute/visual, above floor)**
```
┌───────────────────────────────────────────────┐
│ [photo]  Max · Dog                  ◆ 82% match │
│          Near Eastside · ~1km away              │
│                                                 │
│          Is this them?                          │
│          [ Confirm & connect ]  [ Not a match ] │
└───────────────────────────────────────────────┘
```

**B. Verified owner (microchip path — definitive)**
```
┌───────────────────────────────────────────────┐
│ [photo]  Bella · Cat        ✔ Verified owner    │
│          Microchip match — registered owner      │
│          [ Connect with owner ]                  │
└───────────────────────────────────────────────┘
```
`✔ Verified owner` is a distinct, calm, high-trust state (not a % score) — the cheapest, highest-certainty result we render.

**C. Honest status (below confidence floor / still scanning)**
```
┌───────────────────────────────────────────────┐
│ ⟳ We're checking for matches nearby             │
│   Owners of pets matching this description will  │
│   be alerted if there's a strong match.          │
└───────────────────────────────────────────────┘
```
Replaces the current premature "owners have been notified." Backed by the backend confidence floor (`canConnect:false`) — no false hope.

**D. Connect / relay entry (after Confirm)**
```
┌───────────────────────────────────────────────┐
│ ⚠ ReunitePets never asks for payment or a       │  ← antiScamBanner (backend string)
│   reward to reconnect you. Report anything else. │
│ ─────────────────────────────────────────────── │
│ Relay with Max's owner          [ ⚑ Report ]    │
│ [ message thread — no phone/email shown ]        │
│ [ type a message…                    ] [ Send ]  │
└───────────────────────────────────────────────┘
```
No raw phone/email/exact coords. Both-party opt-in unlocks direct contact later.

**E. Empty / rate-limited (abuse-resistance states, designed-in not bolted-on)**
- No matches yet → reassuring empty state, not a blank gap.
- Rate-limit hit (anonymous flood guard) → clear, non-punitive message + retry-after.

---

## 4. Honest confidence rendering
- `confidence ≥ floor` → show `% match` **with** a text label + icon (not color alone): `◆ 82% match` / "Strong".
- `microchip` → never a %, always `✔ Verified owner`.
- `< floor` → no score, state C only.
- WCAG AA: every quality tier carries text + icon, not just hue.

---

## 5. Component decomposition (kills design-system drift)
Replace the inline-styled block with shared components:
- `<MatchCard variant="actionable|verified|status|relay|empty" />` in `frontend/components/case/`.
- Built on `components/ui/Card` + `Button` + Tailwind tokens (midnight/flash). No local `theme` object, no inline `style={{}}`.
- Reused by both the FOUND success screen and the future no-signup finder flow → one card, one source of truth.

## 6. Instrumentation — FULL CHAIN with denominators (per @dev-challenger #3)
Click-through alone is a vanity metric (novelty lift; contact-rate ≠ reunion-rate). Measure the full chain as **rates**, not raw counts, and capture false-confirms:

Events (keyed by `matchId`, `matchSource`, `confidence`):
`match_shown` → `match_confirm_clicked` → `relay_opened` → `match_not_mine` (owner rejects) → `relay_first_owner_reply` → `reunion_confirmed`.

Reported rates (these are exactly the Probe-A conversion inputs in evil-architect's 2×2):
- **confirmed-connects / match_shown** (over matches above the notification floor — see floor definition below)
- **false-confirm rate** = `match_not_mine / match_confirm_clicked` (catches finders confirming the wrong pet)
- **contacted → reunion rate**

Target thresholds to clear (flagged for @architect/@manager ratification, per evil-architect msg 314): HIGH conversion = ≥40% of above-floor matches reach contact AND ≥15% reach reunion. A click lift with a high false-confirm rate is NOT success.

**Floor is defined in P(true-match), NOT raw points (per evil-architect msg 327).** The card consumes a calibrated `pTrueMatch` (0–1), not the raw scorer output. Push/CTA bands: `pTrue ≥ 0.70` → actionable CTA + owner push; `0.40–0.70` → owner feed only (no CTA-triggered alert); `< 0.40` → suppress (state C). This survives re-tuning of matching.js — only the score→probability mapping changes, not the human-meaningful threshold. H5 test asserts on `pTrue ≥ 0.70`, not raw 60.

## 8. Ship-blocking co-requisites (this change does NOT merge without these — per @dev-challenger #1/#2, @evil-architect ACs)
The CTA lives on `report/found`, which is no-auth → the card is shown to an **anonymous** party. The abuse + PII gates are not "phase later"; they gate THIS intervention:

1. **Confidence floor gates the CTA itself — in P(true-match).** `pTrue < 0.70` → render state C (honest status), NO Confirm button, NO owner push (0.40–0.70 may feed the owner silently, server-side). The owner "your pet may be found" alert is server-gated behind the floor. A below-floor match never produces a clickable connect.
2. **Rate-limit the connect action** per IP/device (redis) — same anonymous-identity key as the analyze-pet hardening. Surfaces as state E (non-punitive retry-after).
3. **Photo + geo already required** to produce a found-report (enforced in the finder flow) → no text-only ghost reports can manufacture a match card.
4. **Minimal "request-contact" broker IS acceptable as v1 — conditioned on §9.** Reconciling architect msg 328 (minimal broker approved as v1, expand later) with dev-challenger #2 (no leaking broker): the minimal server-action relay is fine to ship as v1 **if and only if it passes the §9 PII-leak test**. "Expand later" refers to relay *richness* (threading, attachments), NOT to deferring the no-PII guarantee. The no-PII contract holds from v1; only features expand. The CTA does not go live until §9 is green.

## 7a. Dependencies & sequencing (for @manager)
- **This intervention (Confirm-&-Connect on the EXISTING `report/found` match card) does NOT call `/api/ai/analyze-pet`** → it is **NOT blocked** by the analyze-pet merge gate (G1–G3, evil-architect msg 323). It can proceed as soon as the relay/connect API shapes (§7) land.
- The later **no-signup finder funnel** (anonymous photo upload) DOES depend on analyze-pet hardening → it stays blocked until G1–G3 close. Sequence the existing-card CTA first; the funnel follows hardening.

## 9. PII-leak test (must pass before CTA goes live — hand to @tester)
Assertions on the live broker, both directions:
- **Owner-facing** notification/payload contains NO finder phone/email/raw submitted contact. Finder appears only as an anonymous relay handle.
- **Finder-facing** payload contains NO owner phone/email and NO exact coords — only `coarseArea` + identity-confirmation fields (§2).
- Exact coords + direct contact appear ONLY after BOTH parties opt in inside the relay thread.
- Negative test: attempt to read owner PII via the `matchId`/relay endpoints directly (not just the rendered card) — must fail.
If any assertion fails, the CTA waits for the full relay; we do not ship a leaking minimal broker.

## 7. Open questions for @architect (API shapes)
1. Relay thread primitive: `POST /api/relay/{matchId}` (open) + `POST /api/relay/{threadId}/messages` (send)? Confirm shapes before I wire the card.
2. `coarseArea` — string from backend, or `{label, radiusKm}` for me to format? I prefer backend-formatted string (no client-side rounding of sensitive geo).
3. Microchip `verified-owner` — does it skip the confidence floor entirely and always `canConnect:true`?
4. `antiScamBanner` — confirm it's returned per-thread so copy stays backend-owned.
