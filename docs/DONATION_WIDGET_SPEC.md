# Donation Widget Spec (settled 2026-07-21)

The embeddable donation funnel for shelters, rescues, and vets. Design
prototype (interactive): the "Donation Widget" artifact from the founder
session; visual system is midnight/flash/Archivo per the brand.

Ships in the payments phase (one Stripe build, after launch), per
MONETIZATION.md. This doc pins the architecture and product decisions so
they survive until then.

## Architecture: the signpost, not the toll booth

Stripe Connect with STANDARD accounts and DIRECT charges. Explicitly not
the Givebutter model (platform-controlled Express accounts, platform
sticker pricing, platform in the money flow).

- Each org connects (or creates) its own full Stripe account via OAuth.
  The org keeps its own Stripe dashboard forever; the account is an
  asset usable beyond us.
- Charges run directly on the org's account, so the ORG's pricing
  applies, including Stripe's discounted nonprofit rate (~2.2% + 30c vs
  2.9% standard) for eligible 501(c)(3)s.
- Payouts: Stripe to the org's bank on Stripe's standard schedule. We
  are never in the flow of funds, hold nothing, and forward nothing.
- Disputes and refunds belong to the org's account: Stripe notifies the
  org directly and the org responds in its own dashboard. No middleman
  to beg (founder lived the failure mode on Givebutter: platform-owned
  disputes meant chasing support to defend a chargeback).
- Tax receipts carry the org's EIN because the org is the merchant of
  record. We never need to become a regranting charity.

## Revenue: tips only

- 0% platform fee, stated on the widget footer and verifiable by the
  org in its own Stripe dashboard.
- Voluntary donor tip at checkout: chips No tip / 5% / 10% / 15%,
  default 10%, one tap to zero, math shown line by line (org receives X,
  tip to ReunitePets Y, total Z). Tips are a separate charge/line to the
  platform account, never deducted from the donation.
- REJECTED: marking up processing fees and keeping the spread (the
  Givebutter margin). Dishonest labeling, legally gray, discoverable by
  any treasurer, and worth ~1/16th of tip revenue. Never revisit.
- Donations to orgs are never touched; "cover the processing fees"
  checkbox (below) makes the org whole at the donor's option.

## Onboarding flow (org side)

1. From the shelter/vet dashboard: "Set up donations" -> Stripe OAuth
   connect (or hosted signup for orgs with no account).
2. Immediately after connect, for 501(c)(3)s: the nonprofit-rate step.
   "Apply for Stripe's discounted nonprofit rate: five minutes, saves
   ~0.7% on every donation forever," with the application link and
   guidance. (Founder discovered this rate existed after six years and
   ~$8k of losses on other platforms; every org gets walked into it.)
3. Create a campaign: title, goal, impact copy per amount tier.
4. Copy the embed snippet. Campaign, goal, and copy are edited from the
   dashboard afterward; the pasted snippet never changes.

## Donor flow (widget)

Three steps, one decision per screen, matching the house wizard idiom:
1. Amount: frequency toggle (one-time leads; monthly carries a soft
   benefit tag, never pre-selected), preset grid with per-amount impact
   copy ("$50 vaccinates a whole litter"), custom amount.
2. Details + tip: name, receipt email, the tip box (dashed flash border,
   honest copy), "cover the processing fees" checkbox so the org nets
   the full round number (fee shown is the org's REAL rate).
3. Payment: Apple Pay / Google Pay first, then card. Success state:
   supporter number, live goal-thermometer update, share buttons,
   confetti (respects prefers-reduced-motion).

Footer on every state: "0% platform fee" + "Powered by ReunitePets"
(the growth loop; every embed advertises on a site we did not pay for).

## Embed shapes

One script tag; `data-shape` picks the footprint:
- `card`: the full funnel inline (default).
- `pill`: floating button, opens the funnel in an overlay.
- `bar`: compact goal bar for sidebars/footers.

The widget renders as an IFRAME served from reunitepets.org: host-site
CSS cannot leak in, ours cannot leak out, and payment fields stay on our
secure origin regardless of the host page.

## Dispute evidence pack

Because the widget records donor name/email, timestamp, campaign page,
amounts, tip choice, and the receipt we emailed, the org's dashboard
offers one-click "evidence bundle" for any donation: formatted for
Stripe's dispute-response form. Turns a chargeback defense from support
tickets into ninety seconds. Costs us nothing; the data already exists.

## The rate roadmap (how orgs' effective rates keep dropping)

Founder ruling: rungs 1-2 only. Rung 1 is near-zero work (a payment
method toggle + copy in the v1 widget); rung 2 is a single phone call
if volume ever justifies it; rungs 3-4 are parked as too much work for
the savings.

1. **NOW: steer donors to bank payments.** Stripe ACH is 0.8% capped at
   $5, versus ~2.2-2.9% + 30c on cards. The widget actively nudges
   ("pay from your bank and ~2% more goes to the animals"), especially
   for monthly gifts. This out-saves the nonprofit-rate discussion
   entirely and needs no negotiation. Part of the v1 widget build.
2. **AT TRACTION: ecosystem pricing negotiated with Stripe.** Platforms
   with volume negotiate custom pricing for their connected accounts.
   Once shelters process a few $M/yr through the widget, negotiate a
   below-2.2% blended rate for our verified-charity sub-merchants and
   pass it through AT COST (0% platform fee stays true). Shelters keep
   their own accounts; we stay out of the money.
3. **PARKED (founder call: not worth the work): a 0% rail via an existing regranting charity.** Every.org
   (a 501(c)(3) with an API, tip-funded like us) offers 0% processing by
   legally receiving and regranting donations. Offer it as an optional
   second rail beside the org's own Stripe: tradeoffs are payout delay,
   donor data living with the partner, and their tip jar competing with
   ours. Also serves not-yet-501(c)(3) rescues that can't get charity
   rates at all. Needs a real evaluation before commitment.
4. **PARKED (founder call: not worth the work): the Giving Fund model.**
   ReunitePets receives donations at its own charity rates, issues
   receipts, regrants to shelters. Legally real, operationally heavy:
   ~40-state charitable solicitation registration, disbursement ops,
   chargebacks ours, compliance staffing. Earns its keep somewhere
   north of ~$10M/yr in flow. The destination, not the start.

Context that shaped this: Stripe's nonprofit rate is per-account and
requires 80%+ freely-given-donation volume (services-heavy orgs like
the founder's AALB don't qualify on their main account; a dedicated
donations-only account can). Shelter accounts fed by this widget are
near-100% donations, the cleanest possible qualifiers.

## Eligibility and guardrails

- Donation processing is offered to claimed, verified orgs (the existing
  shelter claim/approve flow gates it; vets get a parallel claim path).
- Fair-use and anti-fraud: rate limits on checkout attempts, Stripe
  Radar on the org accounts, no anonymous org onboarding.
- The free product never degrades to sell anything: the widget is free
  for every org, forever, same as the rest of the platform.
