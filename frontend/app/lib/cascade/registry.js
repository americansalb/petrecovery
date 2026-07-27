/**
 * The cascade action registry - the ordered set of things that fire when a
 * lost report is created. Each entry is metadata only; the run() implementations
 * live in actions/*.js and are attached in runCascade.
 *
 * tier: 0 = no deps (launch immediately), 1 = needs qr/ai copy, 2 = needs
 *       finished assets. Actions in the same tier run concurrently; tiers run
 *       in order.
 * deps: step keys that must SUCCEED first (a failed dep -> this step SKIPPED).
 * enabled: flip on as each PR lands. Only enabled actions get a seeded step and
 *          run - so the dashboard only ever shows real, working items.
 * logAction: the EventLog action verb (create|update|read|transition).
 */

export const CASCADE_ACTIONS = [
  // ── Tier 0 ────────────────────────────────────────────────────────
  { key: 'qr', tier: 0, deps: [], label: 'QR code', logAction: 'create', enabled: true },
  { key: 'ai_copy', tier: 0, deps: [], label: 'Flyer copy & captions', logAction: 'create', enabled: true },
  { key: 'reverse_match', tier: 0, deps: [], label: 'Match against found pets', logAction: 'read', enabled: true },
  { key: 'shelter_strays', tier: 0, deps: [], label: 'Check shelter strays', logAction: 'read', enabled: true },
  { key: 'shelters', tier: 0, deps: [], label: 'Nearby shelters', logAction: 'read', enabled: true },
  { key: 'neighbor_alert', tier: 0, deps: [], label: 'Alert neighbors', logAction: 'update', enabled: true },
  { key: 'rescue_force', tier: 0, deps: [], label: 'Rescue force', logAction: 'read', enabled: true },
  // ── Tier 1 (need QR + copy) ──────────────────────────────────────
  { key: 'flyers', tier: 1, deps: ['qr'], label: 'Printable flyers', logAction: 'create', enabled: true },
  { key: 'social', tier: 1, deps: ['qr'], label: 'Social share images', logAction: 'create', enabled: true },
  { key: 'search_plan', tier: 1, deps: [], label: 'Search plan', logAction: 'create', enabled: true },
  { key: 'share_targets', tier: 1, deps: [], label: 'Local places to post', logAction: 'read', enabled: true },
  // `checklist` is intentionally folded into search_plan's "Do this first"
  // section (same petAdvice source) rather than shipped as a redundant step.
  { key: 'checklist', tier: 1, deps: [], label: 'First-24h checklist', logAction: 'create', enabled: false },
  // ── Tier 2 (need finished assets) ────────────────────────────────
  // `share_kit` is derivable client-side from the captions + social asset urls
  // the case page already reads, so it isn't persisted as its own step.
  { key: 'share_kit', tier: 2, deps: ['flyers', 'social'], label: 'Share kit', logAction: 'create', enabled: false },
  { key: 'recovery_email', tier: 2, deps: [], label: 'Recovery-kit email', logAction: 'create', enabled: true },
  { key: 'followups', tier: 2, deps: [], label: 'Follow-up reminders', logAction: 'create', enabled: true },
];

export const ENABLED_ACTIONS = CASCADE_ACTIONS.filter((a) => a.enabled);
export const ENABLED_KEYS = ENABLED_ACTIONS.map((a) => a.key);
export const MAX_TIER = CASCADE_ACTIONS.reduce((m, a) => Math.max(m, a.tier), 0);
