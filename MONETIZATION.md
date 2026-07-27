# Monetization Model v3 (decided 2026-07-27)

The goal is unchanged: permanence, not profit — enough revenue that the
platform is forever operational for the benefit of the world, with
enough left over to hire the humans (support, moderation, community)
who keep it healthy.

v3 records the founder's 2026-07-27 direction. What changed from v2:
advertising to users is now a planned revenue stream (v2 ruled it out),
a paid shelter CRM tier is planned ON TOP of the free portal, and
boosted reach grew into a fuller AI-assistance product with an explicit
free-when-relevant rule for notification boosts. What did not change:
shelters get everything the platform can do for free, and nobody is
ever charged for the thing that finds their pet.

## Principles

1. **Shelters get everything the platform can do, free.** The whole
   portal — roster, Health Book per animal, stray-vs-lost matching,
   stray-hold tracking, adoption handoffs with full history, the
   adoption-inquiry inbox, team seats, the public page — free forever,
   with no caps an honest shelter could hit. This is the mission AND
   the acquisition strategy: every shelter attracted is a roster being
   matched against lost-pet reports, which makes the product better
   for everyone. The free portal never gets worse to sell a paid tier.
2. **Never price desperation.** It is wrong to make people pay when
   they are desperate — and we actually want the pet found. Everything
   that finds a pet (recovery, matching, alerts, community search) is
   free. Money only ever buys *extra* reach on top of a free product
   that is genuinely trying its best.
3. **Relevant boosts are free; extra amplification is paid.** When the
   platform has real signal — a pet was spotted near your home base, a
   likely shelter-intake match, a sighting cluster — the notification
   boost is free, because the point is the reunion. Paid boosts exist
   only for "even more" reach beyond what the signal justifies.
4. **Abuse limits are not pricing.** Fair-use ceilings (pet-creation
   rate limits, per-shelter roster ceilings, photo caps) exist to stop
   scripts, set high enough that no honest user ever meets them, and
   raising them is free ("contact us").
5. **No hostage-taking.** Data export is free for everyone always. The
   easier it is to leave, the safer it is to stay.

## Revenue streams

1. **Advertising to users.** New in v3 — supersedes v2's blanket "no
   advertising platform" principle. User-facing surfaces may carry
   clearly-labeled ads. Standing guardrails that survive from v2: no
   ads on shelter pages (that promise is live on /for-shelters and is
   kept), no selling user data, no pay-for-placement in any directory,
   search result, or match. Format and partners TBD.
2. **Shelter CRM, paid tier.** Today's portal is the free product,
   whole, forever. A future advanced CRM — deeper workflows, plus v2's
   "Shelter Pro" identity layer (own subdomain, white-label page,
   later bring-your-own domain) — is the paid layer, sold to shelters
   that already love the free one.
3. **AI-boosted lost-pet assistance.** Paid: AI builds the owner's
   outreach from the pet's profile — social posts and ads for
   Facebook/Instagram and beyond — wider reach than PawBoost and far
   more customizable, auto-paused the moment the pet is marked found.
   Pricing thought carried from v2: flat $5 service fee + ad spend
   passed through at cost. Founder holds the final go/no-go.
4. **Paid notification boosts.** Extra push/alert reach beyond the
   free relevance boosts of principle 3. Free when we have signal;
   paid only for even more.
5. **Carried from v2 (not revisited):** free donation processing for
   shelters/rescues/vets via Stripe Connect at 0% platform fee with a
   voluntary donor tip at checkout (the Givebutter model; embeddable
   widget with a "Powered by ReunitePets" line as the growth loop);
   direct donations to the nonprofit; grants (Petco Love, Maddie's
   Fund, PetSmart Charities) — free-for-shelters IS the grant story.

## Explicitly rejected (unchanged from v2, do not revisit casually)

- **Per-pet or per-animal pricing caps** for shelters. Taxes the exact
  behavior (logging every animal) that powers stray-vs-lost matching,
  and prices out the big municipal shelters whose data matters most.
- **Reward escrow.** Money-transmitter liability, dispute refereeing,
  and a pet-theft incentive, for pennies.
- **Physical products** (QR tags, printed flyers). Inventory, shipping,
  and returns are operational weight a software nonprofit does not want.
- **Ads on shelter pages, selling user data, pay-for-placement.** The
  parts of v2's no-ads principle that v3 keeps.

## Build sequencing

Unchanged: everything above needs exactly one payments build (Stripe:
Connect for donations, subscriptions for the CRM tier, checkout for
boosts), scheduled LAST, after the free core has launched. Nothing paid
is built or gated today — the legacy donate endpoint is intentionally
disabled (410) and no shelter feature checks a plan. The subdomain
plumbing and fair-use guardrails can land earlier with a hand-grantable
flag, so early shelters can be comped the paid tier as a launch gift.

## Naming note

"Rescue Squad" is PawBoost's trademark for their volunteer network. All
user-facing surfaces and public URLs now say "Rescue Force(s)"
(old /rescue-squads URLs 301-redirect). Internal identifiers (DB models,
/api/rescue-squads paths, component names) are not publicly visible and
are deferred; see HANDOFF.md.
