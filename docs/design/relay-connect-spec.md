# Relay / Connect — Implementation Spec (v1)

**Owner:** Architect · **Implements:** `.vaak/vision.md §4c/§4d` (broker contract) · **Consumes:** match-card-spec.md §2/§7/§9
**For:** Developer (endpoints + Prisma model). **Pairs with:** UI-Architect (match card), Tester (§9 PII-leak test).

The connect step is a **broker, not a lookup**: it relays messages between an anonymous finder and a lost-pet owner without exposing either party's PII (phone/email/exact coords) until BOTH opt in. This is the single ship-blocking guarantee — see the PII-leak test (match-card-spec §9). The CTA does not go live until that test is green.

> ⚠️ `schema.prisma` is being edited concurrently — coordinate before adding the models below (ping architect on the board). Models are additive; no changes to existing models required.

---

## 1. Prisma models (additive)

```prisma
enum RelayStatus {
  OPEN           // thread created, awaiting owner
  OWNER_REPLIED  // owner has responded at least once
  MUTUAL_OPTIN   // both opted in -> direct contact unlocked
  REJECTED       // owner marked "not my pet" (match_not_mine)
  REUNITED       // confirmed reunion
}

/// One brokered connection between a FOUND report and a LOST case.
/// The opaque `token` is the only id ever exposed to clients (the card's matchId).
model MatchConnection {
  id           String   @id @default(cuid())
  token        String   @unique @default(cuid())   // = card payload `matchId`; never expose case ids

  lostCaseId   String
  lostCase     Case     @relation("LostConnections",  fields: [lostCaseId],  references: [id], onDelete: Cascade)
  foundCaseId  String
  foundCase    Case     @relation("FoundConnections", fields: [foundCaseId], references: [id], onDelete: Cascade)

  // Match snapshot at creation (from lib/matching.js — do NOT recompute in the card)
  matchScore   Int
  pTrueMatch   Float
  matchSource  String   // 'attribute' | 'visual' | 'microchip'

  status       RelayStatus @default(OPEN)
  finderOptIn  Boolean  @default(false)
  ownerOptIn   Boolean  @default(false)
  finderHandle String                                // anonymous, e.g. "Finder-7QX"

  // Verification tier (Evil-Architect msg 309): 0 anon, 1 OTP+owner-accept, 2 mutual opt-in for raw PII
  finderTier   Int      @default(0)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  messages     RelayMessage[]

  @@unique([lostCaseId, foundCaseId])   // idempotent open: one connection per pair
  @@index([token])
}

model RelayMessage {
  id           String   @id @default(cuid())
  connectionId String
  connection   MatchConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  senderRole   String   // 'FINDER' | 'OWNER'
  body         String
  createdAt    DateTime @default(now())
  @@index([connectionId])
}
```

Add the back-relations on `Case`:
```prisma
  lostConnections  MatchConnection[] @relation("LostConnections")
  foundConnections MatchConnection[] @relation("FoundConnections")
```

---

## 2. Where MatchConnections come from

In the existing FOUND-report create flow (report/found path), after `findMatches()` runs:
- For each match with `band !== 'suppress'` (pTrueMatch ≥ FEED_FLOOR), upsert a `MatchConnection` (idempotent on `[lostCaseId, foundCaseId]`) capturing `matchScore`, `pTrueMatch`, `matchSource`, and a generated `finderHandle`.
- The card payload's `matchId` = `connection.token`. `canConnect = (band === 'actionable')` i.e. pTrueMatch ≥ PUSH_FLOOR (0.70) — only actionable matches get a live CTA; feed-band create the connection (so the owner can be fed) but the card shows honest-status, no CTA.

This keeps `matchId` opaque and the floor enforced server-side, not in the client.

---

## 3. Endpoints

All endpoints: rate-limited via `withRateLimitAsync` keyed on the SAME anonymous identity as analyze-pet (`getClientIP` trusted-hop). No auth required (finder is anonymous); owner side is identified via their session when logged in, else via the relay token in their notification link.

### `POST /api/relay/:token` — open (idempotent)
Opens/returns the thread for a connection token. Emits `relay_opened` on first open.
- 404 if token unknown. 403 if connection `band` is below FEED_FLOOR (defense-in-depth; shouldn't happen since suppressed pairs don't get a connection).
- **Response (PII-free):**
```json
{
  "threadId": "<token>",
  "status": "OPEN",
  "counterpartyHandle": "Owner of Max",      // owner side anonymized to pet name only
  "coarseArea": "Near Eastside · ~1km",       // see §4 — snapped server-side, never raw lat/lng
  "antiScamBanner": "ReunitePets never asks for payment or a reward to reconnect you. Report anything that does.",
  "canDirectContact": false                    // true only when status === MUTUAL_OPTIN
}
```

### `POST /api/relay/:token/messages` — send
Body `{ "body": "<text>", "senderRole": "FINDER"|"OWNER" }` (senderRole derived from session/token, NOT trusted from client when determinable). Appends a `RelayMessage`.
- On first OWNER message: set status `OWNER_REPLIED`, emit `relay_first_owner_reply`.
- **Response:** the created message (id, senderRole, body, createdAt). NEVER includes contact fields.

### `GET /api/relay/:token` — fetch thread
Returns `{ ...open-payload, messages: [...] }`. Messages are body+role+timestamp only. Used for display/polling.

### `POST /api/relay/:token/opt-in` — mutual opt-in (Tier-2)
Sets the caller's side (`finderOptIn`/`ownerOptIn`). When BOTH true → status `MUTUAL_OPTIN`, `canDirectContact: true`, and ONLY THEN may direct contact be surfaced (and only the minimum — prefer keeping the relay as the channel even post-opt-in).

### `POST /api/relay/:token/not-mine` — owner rejects
Owner-only. Status → `REJECTED`. Emits `match_not_mine` (feeds the false-confirm-rate metric). Card hides the connection.

### `POST /api/relay/:token/reunited` — confirm reunion
Status → `REUNITED`. Emits `reunion_confirmed`. (Also the conversion-funnel terminal event.)

---

## 4. coarseArea snapping (broker contract §4c — backend's responsibility)
- Snap the lost-case last-seen lat/lng to a ~1km grid (round to ~2 decimal places ≈ 1.1km), reverse-geocode to a neighborhood/landmark label if available, and return a FORMATTED STRING: `"Near <label> · ~1km"` or `"~1km from last seen"` if no label.
- NEVER return raw lat/lng, and never finer than ~1km, to a pre-MUTUAL_OPTIN finder. The client must not round — formatting is server-side only.

## 5. Instrumentation (ties to the existing logEvent / EventLog)
Emit at each transition, tagged `{ token, matchSource, pTrueMatch }`:
`match_shown` (card render — UI emits) → `match_confirm_clicked` (UI) → `relay_opened` (open endpoint) → `match_not_mine` (not-mine endpoint) → `relay_first_owner_reply` (first owner message) → `reunion_confirmed` (reunited endpoint).
These are exactly the Probe-A conversion inputs (vision.md §6 / match-card-spec §6). Use `logEvent()` from `@/lib/logging`.

## 6. PII-leak invariants (the §9 test enforces these — DO NOT regress)
- No endpoint response, at any status < MUTUAL_OPTIN, contains owner OR finder phone/email/raw contact/exact coords.
- Owner-facing notifications reference the finder ONLY as `finderHandle`.
- Finder-facing payloads contain ONLY coarseArea + identity-confirmation fields (pet photo/name/species).
- Direct reading of `/api/relay/:token` by an unverified party must not leak PII either (the negative test).

## 7. Owner notification gate (cruelty gate)
The owner "your pet may be found" push/email fires ONLY when `band === 'actionable'` (pTrueMatch ≥ 0.70) at connection creation. Feed-band (0.40–0.70) may populate an owner FEED silently (no push). Below 0.40: nothing. Use `getConfidenceBand()` from `@/app/lib/matching` — do not re-derive the floor.

## 8. Rate-limiting & abuse
- `POST /api/relay/:token` and `/messages`: rate-limit per anonymous identity (redis), same util as analyze-pet. Surface 429 → UI state E.
- Message body: length cap + basic sanitization (stored as text, rendered as text — no HTML).

---
**Open coordination:** ping architect before touching schema.prisma. I'll review the endpoint PRs against §6 (PII invariants) and §7 (cruelty gate). Tester owns the §9 PII-leak + false-confirm tests as the go-live gate.
