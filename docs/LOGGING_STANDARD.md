# LOGGING_STANDARD.md

## Purpose

Every meaningful action in the system must emit a structured event. This enables:

- Debugging without engineers.
- Admin QA dashboard views.
- Analytics and product insights.
- Forensic analysis after incidents.

This document defines the canonical event structure and usage patterns.

## Event Payload Schema

All events MUST conform to this structure (fields can be `null` where allowed):

```ts
type EventResult = "success" | "failure";

interface EventPayload {
  event_type: string;      // e.g., "mission.created", "squad.join_failed"
  timestamp?: string;      // ISO8601; defaulted by logEvent()
  correlation_id?: string; // UUID; ties related events together in a flow

  actor_user_id?: string | null;
  actor_role?: "OWNER" | "VOLUNTEER" | "SHELTER_ADMIN" | "ADMIN" | "SYSTEM" | null;

  resource_type: string;   // "user", "city", "squad", "mission", "sighting", etc.
  resource_id?: string | null;

  action: "create" | "update" | "delete" | "read" | "transition";

  result: EventResult;

  error_code?: string | null;    // e.g., "CITY_RESOLUTION_FAILED"
  error_message?: string | null; // safe summary (no secrets)

  metadata?: { [key: string]: string | number | boolean | null };
}
```

## The logEvent Utility

All code should call a shared utility, e.g.:

```typescript
logEvent({
  event_type: "squad.join_attempt",
  actor_user_id: user.id,
  actor_role: "VOLUNTEER",
  resource_type: "squad",
  resource_id: squad.id,
  action: "update",
  result: "success",
  metadata: {
    city_id: squad.cityId,
    entry_point: "web",
  },
});
```

Responsibilities of `logEvent`:

- Fill in missing `timestamp` with current time.
- Ensure `correlation_id` exists (generate if not present in request context).
- Validate that `event_type`, `resource_type`, `action`, and `result` are present.
- Enforce reasonable limits on metadata size (e.g., no huge payloads).

## Event Naming Conventions

`event_type` should be namespaced by resource and action:

- `"user.signed_up"`, `"user.login_failed"`
- `"squad.created"`, `"squad.join_attempt"`, `"squad.join_failed"`
- `"mission.created"`, `"mission.status_changed"`
- `"sighting.reported"`
- `"notification.queued"`, `"notification.sent"`, `"notification.failed"`
- `"legal.accepted"`, `"legal.blocked_action"`
- `"admin.health_check_viewed"`, `"admin.test_geocode_run"`, etc.

`error_code` must be:

- Uppermission, snake_mission words.
- Stable over time (don't reuse codes for new meanings).

## Correlation IDs

Each incoming HTTP request should start with a `correlation_id`:

- Either from a header (e.g., `X-Correlation-Id`) or generated.
- All events triggered by that request should reuse the same `correlation_id`.
- Background jobs should generate their own `correlation_id` per job run.

## What Must Be Logged (Minimum Coverage)

At minimum, ensure events for:

**Authentication:**
- `"user.signed_up"`, `"user.login_failed"`, `"user.logged_in"`.

**Legal:**
- `"legal.accepted"`, `"legal.blocked_action"`.

**City Resolution:**
- `"city.resolution_attempt"`, `"city.resolution_failed"`.

**Squad:**
- `"squad.created"`, `"squad.join_attempt"`, `"squad.join_failed"`.

**Mission (when implemented):**
- `"mission.created"`, `"mission.status_changed"`.

**Sighting (when implemented):**
- `"sighting.reported"`.

**Notifications:**
- `"notification.queued"`, `"notification.sent"`, `"notification.failed"`.

**Admin QA:**
- `"admin.health_check_viewed"`, `"admin.test_geocode_run"`, `"admin.test_email_sent"`.

## Privacy & Security

Never log:

- Passwords, tokens, or secrets.
- Full credit card numbers or highly sensitive PII.
- Minimize detailed personal data in metadata (use IDs instead where possible).

## Integration with Admin QA Dashboard

The Admin QA / health page should be able to:

- Query events from the last 24h.
- Group by `event_type`, `result`, and `error_code`.
- Show a small sample of events for inspection.

Any new feature that adds a new `event_type` should also consider:

- Whether it needs a new panel, metric, or view in the Admin QA dashboard.
