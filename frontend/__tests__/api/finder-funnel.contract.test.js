/**
 * EXECUTABLE CONTRACT — finder funnel & confirm-and-connect (Delphi disc. 1).
 *
 * The routes under test DO NOT EXIST YET (no-signup FOUND funnel + relay
 * Confirm-&-Connect). This file is the anti-cruelty / anti-leak spec the team
 * ratified, written as `test.todo` so it ships as a concrete build target, not
 * a backlog sentence. When the routes land, convert each todo into a real test
 * and flip the suite on.
 *
 * Thresholds are Evil Architect's proposed contract (msg 309), grounded in
 * lib/matching.js scoring (species 25 / location 25 / breed 20 / color 15 /
 * timing 15; bands Excellent>=80, Good>=60, Possible>=45, Weak>=35).
 * @architect owns final numbers — update CONTRACT here when ratified.
 *
 * GOLDEN RULE for the PII tests: assert against the raw API JSON payload, not
 * the rendered UI. The cruelest leaks are fields the screen hides but the
 * response still ships.
 */

const CONTRACT = {
  // Owner-notify confidence floor — anti-cruelty tiers.
  ownerNotify: {
    autoPushMinScore: 60, // >=60 (Good+): auto push "possible match found"
    feedOnlyMinScore: 45, // 45-59 (Possible): pull-only in owner feed, NO push
    // <45 or species mismatch: never surfaced to owner
    speciesMismatchScore: 0, // hard gate: cross-species => 0, never notify
  },
  // "Verified finder" graduated trust for PII disclosure (NOT a full account).
  finderTiers: {
    // Tier 0 (anonymous, just submitted): pet photo + name + COARSE area only.
    // Tier 1 (OTP/authed proof AND owner accepted): in-app relay thread, still
    //         no raw phone/email/exact coords.
    // Tier 2 (mutual opt-in via relay): direct contact + exact coords unlock.
    coarseRadiusMiles: 1.0,
  },
  // Funnel input requirements.
  funnel: {
    requirePhoto: true,
    requireGeo: true, // no text-only ghost FOUND reports
  },
};

describe('CONTRACT: owner-notify confidence floor (anti-cruelty)', () => {
  // T-confidence-A
  test.todo('FOUND scoring 50 (Possible) against an open LOST => NO push; appears in owner feed only [FEARED: false-hope push]');
  // T-confidence-B
  test.todo('FOUND scoring 72 (Good) => exactly ONE owner push [FEARED: zero=missed or duplicate pushes]');
  // T-confidence-C
  test.todo('cross-species (found cat vs lost dog) at high attribute overlap => score 0, surfaced NOWHERE [FEARED: any owner contact]');
  // T-confidence-D
  test.todo('text-only FOUND (no photo AND/OR no geo) => rejected before the notify path [FEARED: notifies]');
});

describe('CONTRACT: PII brokering on confirm-and-connect (assert raw payload, not UI)', () => {
  // T-pii-A
  test.todo('Tier-0 anonymous finder hits match-detail/connect API => payload has NO owner phone/email and NO exact lat-lng; only coarse area');
  // T-pii-B
  test.todo('Tier-1 finder (OTP passed + owner accepted) => relay thread works; STILL no raw phone/email/exact coords in any payload');
  // T-pii-C
  test.todo('exact owner coords remain coarsened until Tier-2 mutual opt-in [FEARED: full-precision lat-lng in any pre-Tier-2 response]');
  // Anti-scam surface
  test.todo('connect step never exposes a payment/reward field and carries the "ReunitePets never asks for payment" trust banner contract');
});

describe('CONTRACT: funnel abuse resistance (ships WITH the funnel, not later)', () => {
  test.todo('per-IP/device rate limit on anonymous FOUND submit (spam-cannon) => 429 past threshold');
  test.todo('photo + geo are REQUIRED fields server-side (not just UI-required)');
});
