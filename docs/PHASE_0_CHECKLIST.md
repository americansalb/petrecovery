# Phase 0 Checklist – Critical Foundations

Before we treat MASTER_PLAN.md (Phases 1–108) as executable, these items MUST be completed.

## 1. Admin QA / Health Dashboard

- [ ] `/admin/health` route exists and is protected by admin auth.
- [ ] DB health check:
  - [ ] Simple query runs and latency is displayed.
- [ ] External service checks (for each service we actually use):
  - [ ] Geocoding API
  - [ ] Email service
  - [ ] (Any other external dependency currently integrated)
- [ ] Recent error summary:
  - [ ] Count of events with `result = "failure"` in last 24h.
  - [ ] Grouped by `event_type` and `error_code`.
  - [ ] Ability to click into a sample of recent failures.
- [ ] Key metrics:
  - [ ] Total users
  - [ ] Total cities
  - [ ] Total rescue squads
  - [ ] (Later) Total cases, total sightings, total notifications.
- [ ] Flow tests:
  - [ ] "Test geocoding" form (enter ZIP/city → see resolved City + raw result).
  - [ ] "Send test email" button (to logged-in admin's email).

## 2. Structured Logging Standard & Utility

- [ ] `LOGGING_STANDARD.md` exists and defines the canonical event schema.
- [ ] A single `logEvent(event: EventPayload)` utility exists:
  - [ ] Adds `timestamp` and `correlation_id` when missing.
  - [ ] Validates required fields (`event_type`, `resource_type`, etc.).
- [ ] All rescue-squad–related flows use `logEvent` instead of `console.log`.
- [ ] We have at least one example of `logEvent` per resource:
  - [ ] User-related action
  - [ ] City resolution action
  - [ ] Squad search/create/join
- [ ] Admin QA dashboard can display:
  - [ ] Total events in last 24h.
  - [ ] Breakdown by `event_type`.
  - [ ] Breakdown by `result` (success vs failure).

## 3. Legal Tracking on Users

- [ ] User model (or related tables) includes:
  - [ ] `tos_accepted_at`
  - [ ] `tos_version`
  - [ ] `waiver_accepted_at`
  - [ ] `waiver_version`
- [ ] There is at least one `LegalDocument` record per type:
  - [ ] ToS (`type = "TOS"`)
  - [ ] Privacy Policy (`type = "PRIVACY"`)
  - [ ] Liability Waiver (`type = "WAIVER"`)
- [ ] On signup / login, or before critical actions:
  - [ ] If user lacks current ToS/waiver acceptance, they are redirected to a legal acceptance flow.
- [ ] Critical actions are blocked without acceptance:
  - [ ] Joining a city rescue squad.
  - [ ] Creating a lost-pet case (when implemented).
  - [ ] Accepting/participating in missions (when implemented).
- [ ] All legal acceptance events are logged with `legal.accepted` and include:
  - [ ] `user_id`
  - [ ] `document_type`
  - [ ] `document_version`

## 4. Code Audit & Phase Mapping

- [ ] VISION.md contains a "Current Phase Status" section that lists:
  - [ ] Which phases (from MASTER_PLAN.md) are fully implemented.
  - [ ] Which are partially implemented.
  - [ ] Which are not started.
- [ ] We have identified:
  - [ ] All current uses of rescue squads.
  - [ ] All current logging patterns.
  - [ ] All current legal/ToS flows (if any).
- [ ] Known gaps and tech debt are noted in VISION.md or a tech-debt list.

**Phase 0 is considered complete only when ALL items above are checked.**
