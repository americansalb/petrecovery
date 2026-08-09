# Owner Engagement Plan

**Founder direction (2026-08-08):** the owner is the person with the most at
stake, so the product treats them as the operator. They own their profile,
their pet, and their communication. We email them regularly: what to do next,
what to share, and every time a found pet of their species shows up near their
case, even when it is probably not their pet.

One rule carried over from the earlier match work: we never *claim* a match we
do not have. The founder's ask fits inside that rule with two kinds of email:

- **Match email** (strong match): "Possible match for Max."
- **Nearby email** (everything else close by, same species): "A found dog was
  just reported near where Max went missing. It may not be Max. We send these
  for every found dog close to your case so you can check quickly."

False hope comes from overclaiming, not from information. The nearby email
claims nothing; it hands the owner a photo and a link.

## What already exists (verified in code)

| Piece | State |
|---|---|
| `EmailPreference` model | built: `sightingAlerts` toggle, `unsubscribeToken`, `unsubscribedAt` |
| One-click unsubscribe | built: `/api/unsubscribe/[token]?type=sighting_alerts` |
| `EmailLog` audit table | built, unused on this path |
| Branded email layout | built: `renderBrandedEmail` in `app/lib/email.js` |
| Day 1/3/7 follow-up engine | built: `app/lib/cascade/followups.js` + sweep/piggyback drain |
| Match emails to owners | built for strong matches only, plain unbranded HTML |
| Nearby-found emails | **not built** (the gap the founder named) |

## The build, in order

### Part 1 (built today): nearby-found owner alerts

When a found pet is reported, every owner of an open lost case gets told:

- Strong match: in-app notification + match email (as before).
- Any other open lost case of the same species within **10 miles**: nearby
  email. Email only, no in-app push, so the bell stays meaningful.
- One email per owner per found report, even if they have two lost pets nearby.
- Respects `EmailPreference`: skipped if `sightingAlerts` is off or they
  unsubscribed. Every email carries the one-click unsubscribe link.
- Skips placeholder emails (phone-only reporters).
- Every send is written to `EmailLog` so we can see what we sent whom.
- Both tiers link to the found pet's own case page, so the owner lands on the
  photo of the actual dog, not on a page with nothing on it. This also
  un-dead-ends the in-app notification until the match-review screen lands.

New module: `app/lib/ownerAlerts.js`. The found-pet route calls it; the inline
notify block is deleted.

### Part 2 (built today): follow-up emails must survive the search starting

`followups.js` treated any status except `ACTIVE`/`PENDING` as "resolved", so
the day-3 and day-7 check-in emails stopped the moment a rescue force accepted
the case. `PENDING` is not even a real CaseStatus. Same bug family as the
matcher fix; same repair: resolved means `REUNITED` or `CLOSED_OTHER` only.

### Part 3 (next): the owner's match screen + Confirm and Connect

The durable page that shows an owner every candidate found pet for their case,
with a confirm button that opens the relay thread. This is Phase 0 of
`docs/MVP_LAUNCH_PLAN.md`; the notifications from Part 1 will be repointed at
it when it exists.

### Part 4 (next): regular guidance emails

The day 1/3/7 engine already sends encouragement. Extend it to carry the
owner's actual tools: link the flyer PDF and share images from their recovery
kit, "here is what to post today", "here is the shelter list for your area".
Weekly digest for long-running cases (`EmailPreference.weeklyDigest` exists).

### Part 5 (next): ownership surfaces

- Settings page wired to `EmailPreference` (the model is ahead of the UI).
- Per-case choice: show my phone publicly or route contact through the site
  (this is founder decision A in the launch plan).
- Mark-as-reunited nudge in every follow-up email.

## What "robust" means here, concretely

- No email without an unsubscribe path.
- No email claiming more certainty than the matcher has.
- Every send logged to `EmailLog`.
- One recipient failing never blocks the report or the other recipients.
- Every behavior above pinned by a test that fails if it regresses.

## Abuse hardening (2026-08-09 self-review, "expect people to abuse us")

Adversarial review of Part 1. The nearby-email fan-out is a real attack surface;
this records every hole found, what is fixed, and what is deliberately deferred.

### Fixed

- **Weaponizable email cannon (was CRITICAL).** `found-pet` is anonymous and
  fans real email out to every nearby same-species owner from an unbounded
  query, with only a weak in-memory 60/min-per-IP middleware backstop. Abused
  three ways: mass-blast that burns the sending domain's reputation (breaking
  ALL platform email), targeted false-hope harassment, and an email/DB cost
  bomb. Now guarded three ways, each tested and verified live:
  - `PUBLIC_WRITE` rate limit on the route (10/min/IP, Redis-backed, 5-min
    block) - the same guard its sibling `reports/create` already carried.
    Verified: a 20-request burst returns 10×200 then 10×429.
  - Candidate query bounded (`take: 500`), so one report in a dense metro can
    never load thousands of rows.
  - Hard per-report blast cap (`MAX_OWNER_ALERTS_PER_REPORT = 200`) in
    `ownerAlerts`, nearest-first, match tier never dropped, overflow logged
    (never silently truncated). Defense in depth: holds even if a caller
    ignores the query bound.

### Deferred (named, ranked, NOT silently shipped)

- **HIGH - the nearby email links to a page that leaks the finder's phone.**
  `GET /api/public/missions/[caseNumber]` returns finder name + phone with no
  auth. This is launch-plan P1-1; Part 1 now drives traffic to it. Must be
  settled with founder decision A (public contact vs relay) before these emails
  go out in production.
- **MEDIUM - no per-owner cooldown.** The rate limit caps a flood at 10/min/IP,
  but within that a single owner can still receive one email per accepted
  found report (verified: 10 accepted Mutt reports = 10 emails to Max's owner).
  Needs a per-recipient throttle (e.g. at most one nearby email per owner per
  found pet per N hours), checked against `EmailLog`/`Alert`.
- **MEDIUM - ignores `quietHours` / `digestFrequency`.** The schema promises
  batching (IMMEDIATE/DAILY/WEEKLY) and quiet hours; Part 1 sends immediately
  regardless. A user who chose "weekly digest" still gets instant sends.
- **MEDIUM - unsubscribe is a GET.** Email scanners prefetch links and silently
  unsubscribe people. A POST one-click handler already exists; the email should
  ship the RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers, not a
  bare GET link.
- **LOW - `unsubscribeToken` is `cuid()`**, not crypto-random. Guessable in
  principle; low stakes (unsubscribe only), but not best-practice.
