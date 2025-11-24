# Feature Spec: Admin QA / Health Dashboard

**Status:** Draft
**Owner:** Product + Engineering
**Last Updated:** November 24, 2025

---

## 0. Summary

Create an **Admin QA / Health Dashboard** at `/admin/health` that gives non-developer admins a real-time view into:

- Service health (DB + external deps)
- Recent error events
- Key operational metrics
- Simple "flow tests" (geocoding, email, etc.)

This dashboard is the **primary interface for observability** and is a **Phase 0 blocking requirement**: no serious rollout happens without it. All future phases (1–108) must integrate with this dashboard by:

1. Emitting structured events per `LOGGING_STANDARD.md`, and
2. Surfacing at least one relevant metric/check on this page where applicable.

---

## 1. Problem Statement

Right now:

- Errors are only visible via logs and developer tools.
- Non-technical admins cannot:
  - See if the system is "healthy".
  - Diagnose why something is broken.
  - Test basic flows (e.g., geocoding, notification sending).
- Logging is being reintroduced, but it's not yet **useful** without a way to observe it.

Given the long-term plan (108 phases, legal risk, volunteers, shelters, AI, etc.), running blind is not an option.
We need **a single place** where an admin can answer:

- "Is the system up?"
- "What's failing right now?"
- "Are users actually doing things?"
- "Can I reproduce basic flows without calling a developer?"

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Provide a **single dashboard** at `/admin/health` with:
  - ✅ Service health indicators (DB + external services we actually use).
  - ✅ Recent error summaries (from structured event logs).
  - ✅ Key operational metrics (users, cities, squads; later: cases, sightings, notifications).
  - ✅ Admin-triggered flow tests (e.g., geocode a city/ZIP, send test email).
- Make it possible for a **non-developer admin** to:
  - Confirm whether an issue is local or systemic.
  - Capture enough context for a dev to debug without reproducing from scratch.
- Enforce **Phase 0 observability discipline**:
  - All new features must emit events that show up here.
  - Admin QA becomes the "home screen" for diagnosing issues.

### 2.2 Non-Goals (for this first version)

- No fancy dashboards / BI tooling / charts (v1 is simple, functional).
- No multi-tenant org view (assume a single deployment).
- No role management UI (assume "admin" role already exists).
- No permanent log viewer with full-text search (we show summaries + small samples).

---

## 3. User Stories

**Admin**

1. As an **admin**, I want to see at a glance whether the **database and core external services** are up, so I can tell if an issue is systemic or local.
2. As an **admin**, I want to see **recent errors grouped by type**, so I can understand the most common failures in the last 24 hours.
3. As an **admin**, I want to see **basic operational metrics** (users, cities, squads, etc.), so I know the system is actively in use.
4. As an **admin**, I want to **run test actions** (test geocoding, test email), so I can verify if a subsystem works without touching production data.
5. As an **admin**, I want to **view a sample of failed events** with correlation IDs, so I can hand useful context to developers if escalation is needed.

**Developer (Secondary)**

6. As a **developer**, I want admins to have **enough information to self-triage** issues, so they only escalate when there is a real defect and can include correlation IDs / error codes.
7. As a **developer**, I want **all core flows** to emit events visible on this page, so I can see the impact of code changes without digging in logs.

---

## 4. Scope & Functional Requirements

### 4.1 Route & Access

- Route: `GET /admin/health`
- **Access Control:**
  - Only users with `role = "ADMIN"` (or equivalent) may view.
  - Unauthorized users receive 403 and are redirected / shown an error.

### 4.2 Service Health Panel

For v1, **at minimum**:

- **Database health**
  - Simple read query (e.g., `SELECT 1` or small count).
  - Display:
    - Status: ✅ OK / ❌ DOWN / ⚠️ DEGRADED
    - Latency in ms
    - Last checked timestamp

- **Geocoding / City Resolution**
  - Call the currently used geocoding/city lookup integration (e.g., zippopotam.us or internal City table).
  - Use a **fixed test input** (e.g., "Austin, TX" or ZIP 78701) so it's deterministic.
  - Display:
    - Status: ✅ / ❌ / ⚠️
    - Latency
    - Short message (e.g., "Resolved to city_id=xyz" or "Timeout").

- **Email Service (if integrated)**
  - Health check endpoint (if provider supports) or noop send dry-run.
  - Display:
    - Status
    - Latency
    - Provider name.

Implementation requirement:

- A backend endpoint (e.g., `GET /api/admin/health/summary`) returns a JSON structure:

```json
{
  "services": [
    {
      "name": "database",
      "status": "ok|degraded|down",
      "latency_ms": 12,
      "detail": "reachable"
    },
    {
      "name": "geocoding",
      "status": "ok|degraded|down",
      "latency_ms": 80,
      "detail": "resolved test input to city_id=123"
    }
  ],
  "checked_at": "2025-11-24T12:34:56Z"
}
```

### 4.3 Recent Errors Panel

Show summary of failures from the last 24 hours, based on LOGGING_STANDARD.md events where `result = "failure"`.

Requirements:

- Backend endpoint: `GET /api/admin/health/errors?since=...&limit=...`
- Data:
  - Grouped counts by:
    - `event_type`
    - `error_code`
  - Each group:
    - `event_type`
    - `error_code`
    - `count`
    - `last_seen_at`
  - For a selected group, fetch sample events:
    - `timestamp`
    - `actor_user_id`
    - `resource_type`
    - `resource_id`
    - `error_message`
    - `correlation_id`
    - `metadata` (truncated)

UI:

- Table "Top Error Types in Last 24 Hours"
- Clicking a row opens a drawer/modal with ~10 sample events.

### 4.4 Key Metrics Panel

For v1:

- Total users
- Total cities
- Total rescue squads
- (Later additions: total cases, sightings, notifications, etc.)

Backend endpoint: `GET /api/admin/health/metrics`

Response example:

```json
{
  "users_total": 1234,
  "cities_total": 500,
  "rescue_squads_total": 45
}
```

UI: simple stat cards.

### 4.5 Flow Test Tools

Two tools for v1:

**Test Geocoding**

- Simple form:
  - Input: `city_or_zip` (string).
- `POST /api/admin/health/test-geocode`
  - Body: `{ "query": "78701" }`
  - Response:
    - Success: resolved city info (ID, name, state, country).
    - Failure: reason and raw error details (sanitized).
- Must log:
  - `event_type = "admin.test_geocode_run"`
  - `result = "success" | "failure"`

**Test Email**

- Button: "Send test email to my admin address".
- `POST /api/admin/health/test-email`
  - Uses the current logged-in admin's email.
  - Response:
    - Success: "Test email queued/sent".
    - Failure: error summary.
- Must log:
  - `event_type = "admin.test_email_sent"`
  - `result = "success" | "failure"`

### 4.6 Integration with Logging

All Admin QA actions must use `logEvent` per `LOGGING_STANDARD.md`:

- `admin.health_check_viewed`
- `admin.test_geocode_run`
- `admin.test_email_sent`

Error paths on Admin QA endpoints must log failures with:

- `result = "failure"`
- `error_code` and `error_message` filled.

---

## 5. UX & Interaction Design

### 5.1 Entry Points

- Direct URL: `/admin/health` (requires admin login).
- Navigation:
  - Add an "Admin" or "System Health" item in the admin/nav area pointing here.

### 5.2 Layout

Top-level sections (stacked or tabbed):

**Overview**

- Service health indicators (cards with status).
- Key metrics (cards).
- Timestamp of last refresh + "Refresh" button.

**Errors**

- Table of aggregated errors (`event_type` + `error_code` + `count`).
- Filters:
  - Time window (last 1h, 24h, 7d – v1 can default to 24h).
- Click row → details drawer/modal with sample events.

**Tools**

- "Test Geocoding" form.
- "Send Test Email" button.
- Space for future tools (e.g., test notification pipelines).

### 5.3 Interaction

**Auto refresh:**

- v1: manual "Refresh" button is enough.
- Future: optional 30–60s auto-refresh.

**Error handling:**

- If `/api/admin/health/summary` fails:
  - Show an explicit error banner: "Health summary unavailable; check logs."
- If `/api/admin/health/errors` fails:
  - Show "Could not load error data" with option to retry.

---

## 6. Backend/API Design

Assume TypeScript backend (e.g., Node/Express/Nest/Next API routes), but this is implementation-flexible.

### 6.1 Endpoints

**GET /api/admin/health/summary**

- Auth: admin only.
- Response: service health summary (see 4.2).
- Logs:
  - `admin.health_check_viewed` with `result = "success" | "failure"`.

**GET /api/admin/health/errors**

- Query:
  - `since` (ISO string) – optional, default last 24h.
  - `limit` – optional cap on groups.
- Auth: admin only.
- Response: aggregated error groups + sample count.

**GET /api/admin/health/errors/:eventType/:errorCode/samples**

- Path params: `eventType`, `errorCode`.
- Query:
  - `since`, `limit`.
- Returns sample events.

**GET /api/admin/health/metrics**

- Auth: admin only.
- Response: counts as per 4.4.

**POST /api/admin/health/test-geocode**

- Body: `{ "query": string }`
- Auth: admin only.
- Uses the same geocoding logic as production flows where possible.
- Logs an event with:
  - `event_type = "admin.test_geocode_run"`
  - `metadata.query`, `metadata.status`

**POST /api/admin/health/test-email**

- Body: none (or optional `to` for future).
- Auth: admin only.
- Sends a test email to current admin's email address.
- Logs `admin.test_email_sent`.

### 6.2 Data Sources

**Events:**

- Whichever internal store we're using for structured events (`logEvent` sink).
- Must support querying by:
  - `timestamp >= since`
  - `result = 'failure'`
  - Grouping by `event_type`, `error_code`.

**Metrics:**

- Direct DB counts (users, cities, rescue squads).
- For small scale, simple count queries are OK.

### 6.3 Performance Considerations

- `GET /summary` must be fast:
  - Parallel health checks where possible.
  - Timeouts on external service checks (don't hang the page).
- Errors endpoints should:
  - Limit samples (e.g., max ~100 per request).
  - Consider indexing `event_type`, `error_code`, `timestamp` for efficiency.

---

## 7. Frontend Implementation

### 7.1 Components

Suggested structure:

- `AdminHealthPage`
  - `HealthOverviewPanel`
  - `ErrorSummaryPanel`
  - `AdminToolsPanel`

Each panel:

- Fetches data via dedicated hook or service layer.
- Shows loading / empty / error states explicitly.

### 7.2 Data Fetching

- Use existing frontend patterns (React Query / SWR / fetch hooks).
- Respect admin auth.
- Always handle:
  - Loading state
  - Error state (with user-friendly messaging)

### 7.3 Analytics

Optionally track admin usage of the dashboard itself:

- `admin.health_page_opened`
- `admin.health_tab_changed` (Overview vs Errors vs Tools)

---

## 8. Security & Permissions

All `/api/admin/health/*` routes require:

- Authenticated user.
- Admin role check.

Do not expose:

- Raw stack traces.
- Secrets / tokens / passwords.
- Highly sensitive PII in metadata.

Ensure CORS / CSRF protections are consistent with the rest of the app.

---

## 9. Logging & Observability Requirements

This feature is itself a core part of observability; it must adhere strictly to `LOGGING_STANDARD.md`.

Events to emit:

- `admin.health_check_viewed`
  - On each visit to `/admin/health` (first load).
- `admin.test_geocode_run`
  - On POST to test-geocode, with `result` and `query`.
- `admin.test_email_sent`
  - On POST to test-email, with `result`.

All failures (DB down, external services down, errors loading events) must:

- Emit `result = "failure"`
- Fill `error_code` and `error_message` with stable, meaningful values (e.g., `DB_HEALTHCHECK_FAILED`, `GEOCODING_HEALTHCHECK_TIMEOUT`, `EVENT_QUERY_FAILED`)

---

## 10. Testing Strategy

### 10.1 Backend

**Unit tests:**

- Health check logic for each service (DB, geocoding, email).
- Error aggregation functions.

**Integration tests:**

- `GET /api/admin/health/summary`:
  - Healthy path.
  - Simulated DB failure.
- `GET /api/admin/health/errors` with seeded events.
- `POST /api/admin/health/test-geocode`:
  - Success and failure paths.
- `POST /api/admin/health/test-email`:
  - Success and failure paths.

### 10.2 Frontend

**Component tests:**

- Renders each panel with mock API responses.
- Displays correct states (loading, error, empty, data).

### 10.3 E2E

Scenario:

1. Log in as admin.
2. Visit `/admin/health`.
3. Confirm health summary loads.
4. Trigger "Test Geocoding" and see result.
5. Trigger "Send Test Email" and see confirmation.
6. Confirm `admin.health_check_viewed` and test events are present in event store (if inspectable).

---

## 11. Definition of Done

This feature is done when:

- [ ] `/admin/health` is reachable and gated by admin auth.
- [ ] Service health panel shows DB + geocoding (+ email if applicable).
- [ ] Recent errors panel shows aggregated failures from the last 24h + sample events.
- [ ] Metrics panel shows counts for users, cities, rescue squads.
- [ ] Tools panel supports:
  - [ ] Test geocoding
  - [ ] Test email
- [ ] All admin actions emit structured events via `logEvent` per `LOGGING_STANDARD.md`.
- [ ] `PHASE_0_CHECKLIST.md` items related to Admin QA are checked off.
- [ ] Automated tests are in place:
  - [ ] Backend unit + integration tests.
  - [ ] Frontend component tests.
  - [ ] At least one E2E test for the happy path.
- [ ] No secrets or sensitive PII are exposed in the UI or logged inappropriately.
