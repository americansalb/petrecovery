# Alert Pipeline — Durable Delivery Design (BR-1 target tier)

**Owner:** Architect · **Status:** Design (follows the inline-wiring bridge) · **Context:** msgs 513/514/515
**Problem:** the reunion notification is the product's reason to exist, and today it is (a) unwired for the primary FOUND-match event (CRIT-A), (b) 500s on a real match (CRIT-B), and (c) where it does fire, it's fire-and-forget with swallowed errors — a transient outage silently loses alerts behind a 201 (REL-1/2). This design makes owner notification reliable, observable, and idempotent, using infra the codebase already has (Prisma + the existing sender libs). No new queue service.

## Two tiers (ship in order)
1. **BRIDGE (inline, this sprint — developer, in found-pet/route.js + sightings):** on each `band==='actionable'` match, synchronously-but-isolated: create the in-app Notification, call `sendFoundPetNotification` (wire the dead code), check the result, write `Alert.deliveredAt`/status, each recipient in its own try/catch. This makes the product WORK. (Already specified in msg 515 step 2.)
2. **DURABLE (this design — the outbox + drain consumer):** make the Alert table a real delivery outbox with retry, backoff, dead-letter, and delivery state, so the bridge's best-effort send can't permanently lose an alert on a transient failure.

## Outbox model (additive to schema — additive only, NOT a db push; manual SQL like relay)
Add to `Alert` (it already has `deliveredAt`):
```
status        AlertStatus @default(PENDING)  // PENDING | SENT | FAILED | DEAD
attempts      Int      @default(0)
lastAttemptAt DateTime?
lastError     String?
dedupeKey     String                          // see idempotency
@@unique([caseId, userId, method, dedupeKey]) // idempotency: one alert per (event, recipient, channel)
@@index([status, attempts])                    // drain query
enum AlertStatus { PENDING SENT FAILED DEAD }
```
`dedupeKey` = a stable hash of the triggering event (e.g. `found:{foundCaseId}` for a match alert, `sighting:{sightingId}`, `status:{caseId}:{newStatus}`). The unique constraint makes "create the alert" idempotent — re-running the producer can't double-enqueue, which (with the consumer marking SENT) closes CORR-6 double-alert.

## Producer (the bridge, step 1)
On a notifiable event: upsert Alert row(s) (PENDING) keyed by the unique tuple, THEN attempt an inline send (best-effort). On success → SENT + deliveredAt; on throw → leave PENDING with lastError. The inline attempt is isolated per recipient and never fails the originating request (BR-1 isolation). The row persists regardless, so the drain can finish what the inline attempt couldn't.

## Latency: inline-first, drain-as-backstop (NOT drain-as-primary)
The reunion alert is the most time-critical message in the product (first hours dominate recovery), so the drain must NOT add a cron-interval of latency to the happy path. The inline send (step 1) delivers MOST alerts in-request, instantly. The drain only ever touches rows that are NOT yet delivered (`deliveredAt IS NULL`) — i.e. failures/transients. A Render-cron minimum (~1 min) is acceptable for RETRY of failures; it would NOT be acceptable as the primary path. (Evil-Architect msg 521.)

## Delivery semantics: at-LEAST-once for the reunion alert (NOT at-most-once)
The naive claim pattern biases at-most-once, which is the WRONG default for THIS message class: a LOST "your pet was found" alert = a pet not recovered (catastrophic); a DUPLICATE "found!" = mildly annoying. So the reunion-alert class biases **at-least-once** — never lose it, accept a rare duplicate — then collapses the duplicate at the provider. (Evil-Architect msg 528, Dev-Challenger msg 529 — converged independently.)

### Claim as a LEASE, not a terminal state (fixes the orphan-row silent drop)
Creation-level dedup (the unique tuple) stops duplicate ROWS. For delivery, the sender (inline OR drain) CLAIMS the row: `UPDATE Alert SET status='SENDING', lastAttemptAt=now() WHERE id=? AND status IN ('PENDING','FAILED')`, dispatch only if rowcount=1. After dispatch: `SENT`+deliveredAt on success, `FAILED`+attempts++ on throw.

THE ORPHAN BUG this would create if SENDING were terminal: claim → dispatch → process CRASHES (serverless timeout / cold-stop — routine) before writing SENT/FAILED → row stuck in SENDING forever → drain (which only picks PENDING/FAILED) NEVER retries → the alert is silently lost, reintroducing the exact failure this tier exists to prevent. So SENDING is a TIME-BOUNDED LEASE: the drain ALSO reclaims stale claims —
`WHERE status IN ('PENDING','FAILED') OR (status='SENDING' AND lastAttemptAt < now() - LEASE_TIMEOUT)` (LEASE_TIMEOUT ≈ 2× max send timeout). A crashed claim's lease expires, the drain re-claims (still atomic — one drainer wins), and it retries. At-most-once on the happy path, at-least-eventually on crash.

### Collapse the rare duplicate at the provider (→ near-exactly-once)
The lease-reclaim can double-DISPATCH if the crash happened AFTER the provider sent but before the status write. Collapse it where the provider supports it: pass a provider-side idempotency/dedup key keyed on `(recipient, event, channel)` to Resend (Idempotency-Key) / Twilio. A reclaim-retry that re-dispatches is then de-duped provider-side → at-least-once delivery WITHOUT a user-visible duplicate. Best of both: never lost, rarely duplicated, duplicate collapsed. (Also closes CORR-6.)

## Consumer (the drain — new)
`POST /api/cron/process-alerts` (protected by a `CRON_SECRET` header; NOT session — it's a machine endpoint):
- Select `status IN (PENDING, FAILED) AND attempts < MAX_ATTEMPTS` (e.g. MAX=5), oldest first, small batch (e.g. 50).
- For each: dispatch by `method` (EMAIL→Resend, SMS→Twilio [currently never invoked — wire it], PUSH→web-push [fix the wrong arg order, push.js:266 expects (prisma,userId,payload)]). 
- On success → status SENT, deliveredAt=now. On failure → attempts++, lastError, lastAttemptAt; if attempts>=MAX → status DEAD (dead-letter).
- Backoff: skip a FAILED row until `lastAttemptAt + backoff(attempts)` (exponential) has passed — implement as a `WHERE lastAttemptAt < now - interval` clause keyed off attempts, or a simple `nextAttemptAt` column.
- `logEvent` each attempt+result (resource_type 'alert', action 'transition', result success/failure) — feeds delivery observability and the conversion funnel.
- Schedule: Render Cron Job (or platform scheduler) hitting the endpoint every 1–2 min. The bridge's inline send means most alerts go out instantly; the drain is the retry/backstop for the ones that didn't.

## Out of scope (flagged): real-time SSE is multi-instance-unsafe
SSE (`sse/notifications.js`) keeps an in-PROCESS connection map → `broadcastToUser` can't reach a client connected to another instance. It's a dead-end today (never called). IF real-time push is wired later, the consumer must publish via a shared pub/sub (Redis), not the in-memory map. Not part of this outbox; noted so it isn't assumed working. (Evil-Architect msg 521.)

## Why this shape (not a heavyweight queue)
- The codebase has no worker/queue service; an outbox-in-Postgres + cron drain is the standard, dependency-free durable pattern and fits Prisma/Render. Redis is present but used for rate-limiting, not a job runner — don't overbuild.
- It degrades gracefully: if the cron is down, alerts still went out inline; if an inline send fails, the cron recovers it. Two independent paths to the same guarantee.

## Observability / admin
- A small admin view (or extend report-log) listing FAILED/DEAD alerts so a human can see what didn't reach owners — a silently-dead alert is the failure mode we're eliminating, so it must be VISIBLE (guard-not-on-write-path principle applied to ops).
- Metric: alerts SENT / alerts created, and time-to-deliver — ties to the reunion conversion funnel (Probe-A).

## Acceptance (tester)
- Keystone: found report w/ actionable match → 201 AND an owner Notification + an Alert row that reaches SENT (inline or via one drain pass).
- Outage sim: stub the email sender to throw → assert the Alert stays PENDING/FAILED (not lost) and a subsequent drain pass marks it SENT once the sender recovers; never a 201 with a silently-lost alert.
- Idempotency: re-run the producer for the same event → no duplicate Alert (unique tuple) and no double-send.
- Dead-letter: sender throws MAX times → status DEAD, surfaced in the admin view, no infinite retry.

## Sequencing
Bridge (step 1) lands first and makes the product functional. This durable tier follows; the schema additions go via a manual additive migration (same pattern as relay — NOT a db push against the drifted shared DB). I'll provide the SQL when the team is ready to land it.
