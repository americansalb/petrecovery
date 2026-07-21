# Monetization Model v2 (decided 2026-07-21)

The goal is permanence, not profit: enough revenue that the platform is
forever operational for the benefit of the world, with enough left over
to hire the humans (support, moderation, community) who keep it healthy.

## Principles

1. **Operations are free, forever, at any honest size.** Recovery,
   matching, the Health Book, and shelter management never cost money.
   No caps on pets, animals, or records. "No free tier, just free" is
   marketing copy AND policy; it is never walked back.
2. **Price identity, reach, and convenience. Never operation.** The only
   things that cost money are things that amplify or brand, and their
   absence never makes the free product worse.
3. **No advertising platform.** No third-party ads, no sponsorships on
   platform surfaces, no affiliate placements, no pay-for-placement in
   any directory or search result. Attention is not for sale.
4. **Abuse limits are not pricing.** Fair-use ceilings (pet-creation
   rate limits, per-shelter roster ceilings, photo caps) exist to stop
   scripts, set high enough that no honest user ever meets them, and
   raising them is free ("contact us").
5. **No hostage-taking.** Data export is free for everyone always. The
   easier it is to leave, the safer it is to stay.

## Revenue streams (all software, one Stripe integration)

1. **Shelter Pro: $15/month, paid annually.** The shelter's own
   subdomain (yourname.reunitepets.org), white-labeled public page with
   ReunitePets branding removed, custom look. Free pages keep the
   ReunitePets branding and stay exactly as functional. Later top tier:
   bring-your-own custom domain.
2. **Donation infrastructure with voluntary tips (the Givebutter
   model).** Shelters, rescues, and vets get free donation processing
   via Stripe Connect: a donate button on their ReunitePets page AND an
   embeddable donation funnel widget they can drop into their own
   websites with one script tag. Platform fee: 0%. Donors see an
   optional "add a tip to keep ReunitePets free" at checkout. Every
   embedded widget carries a small "Powered by ReunitePets" line, which
   is also the organic growth loop.
3. **Donations to the nonprofit** directly.
4. **Grants.** Animal-welfare funders (Petco Love, Maddie's Fund,
   PetSmart Charities) fund exactly this: free software for shelters
   plus automated lost-pet reunification. The free-for-shelters promise
   is the grant story; charging shelters would compete with it.
5. **Boosted reach for a lost pet alert** (status: planned for the final
   build phase; founder holds the final go/no-go). Not on-platform
   advertising: the owner pays to push their own alert out to
   Facebook/Instagram, built automatically from the pet's profile.
   Pricing: flat $5 service fee + ad spend passed through at cost,
   auto-paused the moment the pet is marked found. Requires Meta
   Business verification; deferred to last on purpose.

## Explicitly rejected (do not revisit casually)

- **Per-pet or per-animal pricing caps** for shelters. Taxes the exact
  behavior (logging every animal) that powers stray-vs-lost matching,
  and prices out the big municipal shelters whose data matters most.
- **Reward escrow.** Money-transmitter liability, dispute refereeing,
  and a pet-theft incentive, for pennies.
- **Physical products** (QR tags, printed flyers). Inventory, shipping,
  and returns are operational weight a software nonprofit does not want.
- **Sponsorships, insurance referrals, any third-party commercial
  presence on platform pages.** See principle 3.

## Build sequencing

Everything above needs exactly one payments build (Stripe: Connect for
donations, subscriptions for Pro, checkout for boost if kept), scheduled
LAST, after the free core has launched. The subdomain plumbing and the
fair-use guardrails can land earlier with a hand-grantable flag, so
early shelters can be comped Pro as a launch gift.

## Naming note

"Rescue Squad" is PawBoost's trademark for their volunteer network. All
user-facing surfaces and public URLs now say "Rescue Force(s)"
(old /rescue-squads URLs 301-redirect). Internal identifiers (DB models,
/api/rescue-squads paths, component names) are not publicly visible and
are deferred; see HANDOFF.md.
