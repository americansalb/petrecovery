<!--
  Pre-launch audit, 2026-08-21. Method and evidence are in §1 and §8.
  Every finding here was reproduced first-hand against a running build; claims
  that did not survive that check are listed in §7 rather than deleted, so the
  next person can see what was already ruled out.
-->

# ReunitePets launch audit — 2026-08-21

## Verdict

**Not yet.** The product is closer than the repo's own docs suggest, and the
best parts of it — the homepage, Mission Control, the shelter portal, the case
page, the report wizard — are genuinely good. But six things would go wrong on
day one in ways that are hard to walk back, and two of them are the kind that
end up in a screenshot on social media.

The three that matter most:

1. **An unauthenticated API hands out every lost-pet reporter's name, phone
   number and email**, in bulk, to anyone who asks. This is a scraper's list of
   distressed pet owners — the exact population targeted by "I have your pet,
   send money" scams. The team already fixed this same bug class once, on a
   sibling route, and wrote a regression test for it.
2. **The city landing pages publish randomly generated "Pets Reunited" numbers**
   that change on every refresh. These are public, indexed, and are where Google
   sends someone searching "lost dog austin".
3. **On a phone, the "I've Seen Max" button on a case page is not clickable** —
   the global tab bar is painted over it. That is the product's core loop
   failing on the device most people use.

None of these is a deep architectural problem. All six blockers are small,
local fixes. The estimate below is days, not months.

| | count |
|---|---|
| Blockers (fix before launch) | 6 |
| High (fix in the first week) | 16 |
| Medium | 13 |
| Verified-and-fine / claims refuted | 12 |

---

## 1. Scope and method

**The production domain was not reachable from this environment.** `curl` to
`www.reunitepets.org` and `petrecovery.org` both return `403` from the network
policy's egress gateway. So this audit is of **the code that ships to that
domain**, exercised by running it: PostgreSQL 16 seeded with
`prisma/seed-sample-data.js`, `npm run dev`, and a browser driving it.

Two things follow. Anything that depends on production configuration — whether
`RESEND_API_KEY` is set, what the real shelter dataset looks like, actual
response times under real load — is out of scope and flagged as such where it
matters. And the branch audited (`claude/reunitepets-launch-audit-1u0h0i`) is
at parity with `pet_main`, 0 commits ahead, so this is what would deploy.

What was done:

- **263 screenshots.** The 108-route desktop gallery was regenerated, and 155
  new captures were added covering what it does not: the 1440×900 *viewport*
  (what a visitor sees before scrolling), 390×844 phone views of every key
  route, and error, empty and wizard states. Index:
  `screenshots/audit-2026-08/README.md`.
- **The automated gates were run**, not assumed (§8).
- **Twenty subagents** audited the codebase across 13 dimensions and reviewed
  the screenshots across 7 batches, with an adversarial verification pass.
- **Every finding below was then reproduced by hand** — by reading the code, by
  `curl`, by measuring the live DOM, or by querying the database. Findings that
  did not survive are in §7.

---

## 2. Blockers

### B1 — An unauthenticated API publishes every reporter's name, phone and email

`frontend/app/api/public/missions/[caseNumber]/route.js:193-206`. There is no
`getServerSession` anywhere in the 255-line file.

```
$ curl http://localhost:3000/api/public/missions/AUS-2026-0001     # no cookie
...
"contact": {
  "name":  "Avery Admin",
  "phone": "512-555-0100",
  "email": "admin@localdev.test"
}
```

It is bulk-harvestable. `GET /api/public/missions` — also unauthenticated —
lists every case number, so two calls per victim yields the whole list:

```
cases listed: 5
 - CASE-2026-426052 | Guest      / Not provided  / guestreporter1@localdev.test
 - AUS-2026-0002    | Sarah Chen / 512-555-0101  / sarah@localdev.test
```

Three things make this a blocker rather than a design decision:

- **The current product deliberately does the opposite.** The canonical case
  page `/cases/[caseNumber]` and its API return no phone and no email —
  verified side by side. The live contact model is a brokered relay whose own
  docstring states a "hard contract … NO response below MUTUAL_OPTIN status
  contains owner OR finder phone/email/raw contact/exact coords"
  (`app/api/relay/[token]/route.js:17`). This legacy endpoint still implements
  the policy the product abandoned.
- **The team already fixed this exact bug class.**
  `__tests__/api/reports-id-pii.test.js` locks `/api/reports/[id]` against "a
  PII harvest of distressed owners" and states the rule: *"assert on the raw API
  payload, not the rendered UI — the cruelest leaks are fields the screen hides
  but the JSON still ships."* That is precisely this bug, on the route nobody
  re-checked. Verified: `/api/reports/[id]` is clean; this one leaks.
- **No test covers `/api/public/missions`.**

The same response also returns unfuzzed coordinates (`30.2729, -97.7444`) — and
there is no location-fuzzing helper anywhere in the codebase.

**Fix.** Drop `contact` from this endpoint, or gate it behind a session and the
relay's opt-in state. Extend the SEC-3 regression test to cover it.

### B2 — The lost-pet report intake runs bcrypt inside a 5-second transaction, and 500s

`frontend/app/api/reports/create/route.js:95` opens
`prisma.$transaction(async (tx) => {…})` with **no options**, so it gets
Prisma's default 5000 ms interactive-transaction timeout. The callback runs to
line 252 — 157 lines — and at `:124`, `:129` and `:134` it does
`await bcrypt.hash(…, 12)`, which is CPU-bound and blocks the event loop for
roughly 250-500 ms each time.

Reproduced on an idle local database, three sequential anonymous reports:

```
req1 -> 200
req2 -> 500     Transaction already closed: … the timeout for this transaction
req3 -> 200     was 5000 ms, however 7483 ms passed since the start
```

On a network-attached production database under concurrency this gets worse,
not better. This is the single most important write in the product — a person
reporting that their pet is missing — and it fails intermittently.

**Fix.** Hash the password before opening the transaction. Keep the transaction
to the writes.

### B3 — The entire Alerts feature is dead, list and detail

Both halves are broken, independently:

- **`/alerts`** sends `status=OPEN` (`app/alerts/page.js:31`), but `CaseStatus`
  has no `OPEN` — the values are `ACTIVE`, `IN_PROGRESS`, `SIGHTING_REPORTED`,
  `REUNITED`, `CLOSED_OTHER` (`prisma/schema.prisma:820`). Reproduced:
  `GET /api/public/missions?status=OPEN&limit=50` → **500**
  `{"error":"Failed to list public cases"}`.
- **`/alerts/[id]`** reads `data.case` (`app/alerts/[id]/AlertPageClient.js:32`)
  but the API returns the case at the top level (verified: `has .case? false`).
  The resulting `TypeError` on `.lastSeenAt` is caught at `:74` and turned into
  `router.push('/alerts')`. Confirmed in the sweep both logged out
  (`pub-27` → `/login`) and logged in (`auth-102` → `/alerts`), with the console
  error `Cannot read properties of undefined (reading 'lastSeenAt')`.

These are the deep-link targets for "a pet was spotted near you" notifications.
Rechecked on a quiet server to rule out load: still broken.

**Fix.** Send a real status value; read the response at the top level. Add a
test that loads an alert by id.

### B4 — City landing pages publish randomly generated "Pets Reunited" numbers

`app/lost-pet/[location]/LocationPageClient.js:52-57`:

```js
// Mock stats for now
setStats({
  activeMissions:  Math.floor(Math.random() * 50) + 10,
  reunited:        Math.floor(Math.random() * 200) + 50,
  activeSearchers: Math.floor(Math.random() * 100) + 20,
});
```

Rendered at `:163-175` as three stat cards labelled "Active Missions",
**"Pets Reunited"** and "Active Searchers". Four consecutive loads of
`/lost-pet/austin-tx`:

```
load 1:  0,   0,   0     (pre-effect)
load 2: 30,  60, 116
load 3: 30, 149,  42
load 4: 53, 177,  79
```

"Pets Reunited" went 60 → 149 → 177 on three refreshes of the same page. These
pages are public and `robots: index, follow`. Worse, the route accepts any
slug — `/lost-pet/asdfghjkl-qq` returns 200 with
`<title>Lost & Found Pets in Asdfghjkl, QQ</title>` — so the fabricated claim
can be generated for any string, indefinitely.

This is a fabricated performance claim on an indexed page, and it is trivially
discoverable by pressing F5.

**Fix.** Query the real numbers, or remove the cards. Then either validate the
slug against the city list and 404 unknown ones, or `noindex` them.

### B5 — On a phone, the case page's sighting button is not clickable

Measured at 390×844 on `/cases/AUS-2026-0001`:

```
Before scrolling: the "I've Seen Max" CTA is at top: 1010px in an 844px
                  viewport — 166px below the fold.

After scrolling:  sticky CTA container   top 743 → 844   (101px, z-index 40)
                  global tab bar          top 779 → 844   (65px,  z-index 50,
                                                           background: white)

Hit test at the centre of the CTA: ctaContainsHit = false
```

The tab bar (`app/components/GlobalBottomNav.js:61`, `fixed bottom-0 … z-50
bg-white`) is opaque and sits above the sticky CTA
(`StickyMobileCTA.js:46`, `fixed bottom-0 … z-40`). It covers 65 of the CTA's
101 pixels, and a tap at the CTA's centre hits the tab bar and navigates away.

See `screenshots/audit-2026-08/state/30-mobile-case-scrolled-cta.png`.

A neighbour who just spotted the dog opens the shared link, scrolls, taps the
one button that files a sighting — and gets sent to another page.

**Fix.** Raise the CTA above the tab bar and add bottom padding equal to the tab
bar height plus the safe-area inset, or suppress the tab bar on case detail.
Verify by tapping the centre point, not by looking at it.

### B6 — Nothing reports errors in production

`frontend/app/lib/errorTracking.js` is a stub. Every Sentry call in it is a
comment (`// Sentry.captureException(...)`), `@sentry/*` is **not** in
`package.json`, and `initErrorTracking()` is never called anywhere. Exactly one
file imports the module. There is no `app/global-error.js`.

A server-side exception in production goes to stdout and nowhere else. No
alert, no aggregation, no ownership.

This is a blocker because of what it does to the others: B2 and B3 are exactly
the kind of failure that would ship, run for weeks, and be discovered only when
a user complains — and B2's victims are people whose report silently failed, who
have no reason to come back and tell you.

**Fix.** Wire up any error tracker before launch. This is an afternoon.

---

## 3. High

### H1 — CAPTCHA is not wired up; report intake is limited only to 60/min/IP

`app/lib/captcha.js` implements real reCAPTCHA v2/v3 verification.
**No API route calls `verifyCaptchaFromRequest` — there are zero call sites.**

The only gate is `middleware.js:285-304`, and it (a) does nothing unless
`REQUIRE_CAPTCHA === 'true'` and (b) only checks that the header is *present* —
it never verifies the token. `x-recaptcha-token: anything` passes.

`/api/reports/create` is absent from `RATE_LIMIT_CONFIG`, so it falls to the
default 60/min/IP. Each call creates a `User` row and sends email.

Reproduced: three anonymous POSTs created three real public cases ("Ghost1",
"Ghost3", at "123 Fake St") with no CAPTCHA, no account and no moderation. They
appear in `/api/public/missions`, on the public corkboard, and pushed the
homepage "N pets waiting to come home right now" counter from 3 to 7.

Rate-limit state is an in-memory `Map` (`middleware.js:15`) — per-instance, and
reset by every deploy.

### H2 — A new report never announces itself to the local Rescue Force

Two independent bugs in the same block, both swallowed by one `try/catch`:

- `app/api/reports/create/route.js:533,536,539` interpolate a bare
  `caseNumber`, but `caseNumber` is declared `const` at `:209` **inside** the
  transaction callback (95-252). It is out of scope at 533. Reproduced in the
  dev log on every single report:
  `[Report Debug] Failed to create mascot post: ReferenceError: caseNumber is not defined`
- `:541` writes `isSystemPost` and `isPinned` to `SquadPost`. **Neither field
  exists** — confirmed in both `prisma/schema.prisma:1372-1414` and the raw DDL
  in `app/api/admin/migrate/route.js:58-76`. The create would throw even with
  `caseNumber` fixed.

Verified: my test reports created 0 `SquadPost` rows. The community-mobilisation
loop — the product's whole differentiator — silently does not run.

### H3 — The Hub reports zero threads forever, and returns 200 saying it succeeded

`app/api/hub/stats/route.js:24-25` queries
`prisma.forumThread.count({ where: { isDeleted: false } })` and the same for
`forumPost`. **Neither model has an `isDeleted` field.** The `Promise.all`
rejects, and the catch at `:70-82` returns HTTP **200** with
`success: true` and every count hardcoded to 0.

Reproduced — the database holds 1 thread and 3 categories:

```
GET /api/hub/stats →
{"success":true,"stats":{"totalThreads":0,"totalPosts":0,"totalMembers":0,
 "totalCategories":0,"newestMember":null},"categories":[]}
```

The Hub is one of five links in the frozen universal navbar, and the homepage
sells it as "A community, not just an app". Every visitor who clicks it finds a
dead forum. Because it answers 200 with `success: true`, nothing can detect it.

### H4 — `/my-alerts` is the most broken page in the product

Three separate defects on the page where an owner goes to mark their pet found:

- **It prints `📍 undefined, undefined`.** `app/my-alerts/page.js:562` renders
  `{alert.lastSeenLandmark || \`${alert.city}, ${alert.state}\`}`. The `Case`
  model has `lastSeenAddress` and **no** `city`, `state` or `lastSeenLandmark`
  (`grep -c lastSeenLandmark prisma/schema.prisma` = 0). The `city`/`state` at
  `app/api/missions/route.js:107-108` belong to the nested `rescueSquad`. So the
  fallback always renders the literal string. `app/components/FlyerCard.js:94`
  already does this defensively — the right pattern exists in the codebase.
- **Its filters can never match.** `:63` filters "active" on
  `['OPEN','ACTIVE_SEARCH']` and `:64` filters "found" on `RESOLVED` — none of
  which are `CaseStatus` values. Both tabs are permanently empty, and the status
  labels at `:137-158` fall through to `default: return status`, so owners see
  the raw enum `IN_PROGRESS`.
- **It is off-brand**: royal-blue header bar, bootstrap-red "+ New Report"
  (`fold/59-my-alerts.png`).

### H5 — 16 of 26 admin pages bounce to `/dashboard` on any hard load

The guard, e.g. `app/admin/users/page.js:50-56`, runs while
`status === 'loading'`, when `session` is `undefined`, so
`session?.user?.role !== 'ADMIN'` is true and it calls
`router.push('/dashboard')` before the session ever resolves. There is no
loading guard.

Reproduced this run on `/admin/shelters`, `/admin/shelters/requests` and
`/admin/users`. Bookmarks and refreshes are broken for admins; only in-app soft
navigation works.

### H6 — Login submits the password in the URL before React hydrates

`app/login/page.js:109` is `<form onSubmit={handleSubmit}>` with **no `action`
and no `method`**. React's `onSubmit` only binds after hydration. Before that,
the browser performs its default submit — a GET to the current URL with the
fields as query parameters. Captured verbatim during the sweep:

```
navigated to "http://localhost:3000/login?email=admin%40localdev.test
                                          &password=LocalDevScreenshots1%21"
```

The password then lives in browser history, in any proxy or CDN access log, and
in the `Referer` header of subsequent requests. Adding a hydration wait before
clicking made the sweep log in cleanly, which confirms the mechanism.

Same pattern at `app/forgot-password/page.js:108` and
`app/reset-password/page.js:159` — there the leaked field is the *new* password.

### H7 — 19 production-runtime vulnerabilities, 3 critical, in the auth chain

`npm audit --omit=dev`: 19 total — 3 critical, 12 high, 4 moderate.

- **critical** `next-auth` 4.24.13 / `@auth/core` / `@auth/prisma-adapter` —
  "Email normalizer validates the address before Unicode normalization,
  allowing a homoglyph @ bypass"
- **high** `jws` 3.2.2 — "Improperly Verifies HMAC Signature"
- **high** `axios` 1.13.2 — SSRF; `next` 14.2.33 — DoS

CI runs `npm audit … || echo "Vulnerabilities found - review required"`
(`ci.yml:214`), so this has been green the whole time.

### H8 — Sitemap and robots.txt point at the retired domain; the SEO pages are absent from both

- Every one of the 16 URLs in `/sitemap.xml` is `https://petrecovery.org/…`.
  The canonical host is `https://www.reunitepets.org` — middleware 301s the old
  host — so every declared URL redirects.
- `robots.txt` declares two sitemaps, both on `petrecovery.org`.
- The sitemap lists `/cases` (verified **404**) and `/database` (a 301 stub).
- **Not one `/lost-pet/[city]` page is in the sitemap**, though those are the
  primary organic acquisition surface.

### H9 — The push-notification prompt interrupts every screen, including the crisis ones

`app/components/PushNotificationProvider.js:38-41` excludes only `/login` and
`/register`. It fires 3 s after any authenticated page load on every other
route. On mobile it renders `fixed bottom-4 left-4 right-4` (`:92`), covering
roughly 40% of a 390×844 viewport and the whole tab bar.

Captured over: step 1 of the lost-pet report wizard (`auth-52-report-new.png`),
a still-loading `/pets` (`mob/51-pets-fold.png`), a still-loading Mission
Control (`mob/56-mission-control-fold.png`), the message composer, and every
admin screen.

### H10 — "Delete Account" is a shipped button that does nothing

`app/settings/page.js:159-168`. A red "Danger Zone" button whose `confirm()`
says *"This action cannot be undone"*, and which then calls
`toast.warning('Account deletion is not yet implemented. Please contact
support.')`, with `// TODO: Implement account deletion` inline. No
account-deletion route exists anywhere under `app/api/`.

`app/privacy/page.js:44` says users may "request deletion of your account data,
by contacting us", so the *policy* survives — but the UI actively misrepresents,
and there is no deletion pipeline at all.

### H11 — No unsubscribe link on any outbound email

`/api/unsubscribe/[token]/route.js` exists, but **nothing links to it**. No
template references it, and `app/lib/email.js` adds no footer and no
`List-Unsubscribe` header. There are 8 templates in `app/lib/notifications.js`
and zero opt-outs.

SMS, by contrast, is handled correctly — STOP/START/UNSUBSCRIBE at
`app/api/webhooks/twilio/route.js:116-122`.

Beyond compliance, a missing `List-Unsubscribe` header hurts inbox placement at
launch volume.

### H12 — Transactional email is on the old brand and admits an unbuilt feature

- `app/lib/notifications.js` — imported by 8+ live routes including
  `reports/found-pet` and `sightings` — brands 8 templates **PetRecovery.org**
  (lines 64, 92, 240, 410, 580, 745, 864, 966).
- `app/api/webhooks/twilio/route.js:227,229`: SMS opt-out copy says
  "PetRecovery SMS alerts".
- `app/api/reports/create/route.js:668`: an email with the subject *"Welcome to
  ReunitePets.org — Verify Your Email"* whose body reads *"Email verification
  link will be sent separately (coming soon)."* There is no link.
- `app/about/page.js:48`, a public page: "When you see Sarama on
  **PetRecovery**".

Page `<title>` and OpenGraph tags are correct, and case pages serve the pet's
photo as `og:image` — the link-preview system itself is fine.

### H13 — Support address is on the retired domain, including in the Terms and Privacy Policy

Hardcoded `support@petrecovery.org` at `app/contact/page.js:6`,
`app/legal/terms/page.js:10` and `app/privacy/page.js:10`. On `/contact` it is
the single largest CTA, labelled "Monitored 7 days a week", on a site branded
ReunitePets throughout.

A support address on a different domain from the site is one of the specific
things people check for legitimacy — and it is the contact of record in two
legally binding documents.

### H14 — `/care` overstates a study its own footnote contradicts

`app/care/page.js:157` claims pets with records ready "are reunited up to
**20 times** more often". `:175`, three lines below, says the study "found
microchipped pets returned **2.5 times more often for dogs and 20 times for
cats**". The headline generalises the cat figure to all pets.

### H15 — `/admin/auto-migrate` runs raw DDL on page load, with no button

`app/admin/auto-migrate/page.js:21-31` — a `useEffect` that calls
`runMigration()` as soon as a session resolves, commented "// Auto-run
migration". Navigating to the URL, or hitting browser-back onto it, POSTs
`/api/admin/migrate`.

Severity is *high* and not *blocker* because the endpoint is properly guarded —
`isAdmin()` re-reads the role fresh from the database (`:26`) — and every
statement is additive and idempotent (`ADD COLUMN IF NOT EXISTS`,
`CREATE TABLE IF NOT EXISTS`). It cannot drop data today. But it is a page that
fires `$executeRawUnsafe` against production on navigation, duplicating what
`prisma db push` already does at boot. One careless edit makes it destructive.

### H16 — The PWA is never actually installable

- `public/manifest.json` exists but there is **no `<link rel="manifest">`** in
  the rendered HTML and no reference in `app/layout.js`. No `theme-color` meta
  either.
- `manifest.json` sets `"start_url": "/dashboard"` — a protected route — so an
  installed app would open on a login redirect.
- Its icons are on the CDN, not same-origin.
- `public/sw.js` is registered only inside the push flow
  (`app/components/PushNotifications.js:124`), so offline caching and the
  `/offline` page never activate for a normal visitor.

---

## 4. Medium

| # | Finding | Where |
|---|---|---|
| M1 | Case numbers are `CASE-${year}-${last 6 digits of epoch ms}`, which repeats every ~16.7 min against a `@unique` column, and does not match the documented `{CITY}-{YEAR}-{SEQ}`. A correct `generateCaseNumber()` exists but only in the disaster-mode lib. | `reports/create/route.js:209`, `reports/found-pet/route.js:158`, `lib/emergency/disasterMode.js:376` |
| M2 | The public case page paints an **empty white card** whenever a case has no Recovery Kit — the wrapper renders its own border and background even when the child returns null. Verified: `/api/cases/AUS-2026-0001/recovery-kit` → `{"exists":false}`. | `components/RecoveryKitPanel.js:20-28`, `pub-18-case-portal.png` |
| M3 | `/lost-pet/[city]` is a violet-gradient template with indigo/emerald/amber accents — nothing of the brand. On a phone the headline wraps to "Lost & Found / Pets in Austin, / TX". | `mob/16-lost-pet-city-fold.png` |
| M4 | Failure and emptiness are indistinguishable in admin queues: a failed fetch leaves the array empty, so the screen says "All caught up!". | `admin/communities/page.js:290-303`, `admin/divisions/requests/page.js:663` |
| M5 | `/join/[missionId]` renders "Golden **DOG** • Golden Retriever" — the species enum printed raw and mashed into the colour — on the page a stranger opens from a text message. | `pub-28-join-mission.png` |
| M6 | A signed-in non-admin at `/admin` gets raw JSON in the browser: `{"error":"Forbidden","message":"Admin access required"}`. Logged-out is handled correctly. | `middleware.js`, `state/35-member-admin-403.png` |
| M7 | **No footer on any page except the homepage.** `<FooterCta />` appears only at `app/page.js:744`; `app/layout.js` has none. Every other route — including the legal pages — ends with no Privacy, Terms or Contact link. | |
| M8 | Design-system drift: emoji tab icons and a lavender active tab in Settings; bootstrap blue/red on the 404 and `/reset-password`; purple on `/about`; red/green on `/join` and the mobile drawer. The on-brand "Case not found" state proves the right pattern exists. | `settings/page.js:49-52`, `not-found.js`, `reset-password/page.js`, `about/page.js` |
| M9 | Auth actions have three names: nav says "Sign in"/"Join" (`Navigation.js:312,316`), the drawer says "Login"/"Sign Up" (`:500,508`), the login page says "Sign In"/"Create Account". The drawer also lists "Pet Care" twice. | |
| M10 | `.gitignore` uses `*.env`, which matches files *ending* in `.env` — so `frontend/.env.production` and `.env.staging` are tracked. They hold placeholders today (no secret is leaked), but `next build` **does** load `.env.production`, which sets `NEXTAUTH_URL="https://petrecovery.org"`. Change the pattern to `.env*` with `!.env.example` before someone fills in real values. | |
| M11 | `viewport: { maximumScale: 1, userScalable: false }` is set in the `metadata` export, where Next 14 ignores it (896 deprecation warnings in one dev session). Browsers currently get the safe default. **The trap:** "fixing" the deprecation by moving it to a `viewport` export would ship a WCAG 1.4.4 failure. Move it *and* drop those two keys. | `app/layout.js:23-28` |
| M12 | ESLint has never run. `eslint` and `eslint-config-next` are installed but there is no config anywhere, so `next lint` drops into its interactive setup prompt. CI swallows it. | `ci.yml:49` |
| M13 | In-card clipping at 390px: the case page's Search Area header shows "2 sigh"; the rescue-force activity feed clamps every entry to one line, so "Sarah reported a verified sighti…" loses the where and the which-pet. | `mob/05-case-full.png` |

---

## 5. What is genuinely good

This is not a project in trouble. Several parts are better than they need to be.

- **The shelter surface is the most finished thing here.** `/for-shelters` leads
  with "Shelter software that costs nothing", a concrete subhead, and a real
  screenshot of the actual portal — exactly what the house copy rule asks for.
  The portal itself (`fold/62-shelter-dashboard.png`) opens on a "Needs
  attention" list of specific, actionable items in plain language: *"Rufus and
  Clover have no photos yet. Adopters scroll past empty squares, and photo
  matching can't run."*
- **Mission Control delivers on the differentiator**
  (`auth-57-mission-control.png`): live counts, the sighting CTA in the primary
  slot, ways to help, activity log, "Found Max? Mark as reunited", and a visible
  Exit.
- **The homepage holds up at every viewport.** Both primary actions are fully
  visible above the fold on a 390px phone as large thumb-friendly pills.
- **The report wizard is well built** — clear step rail, one question per step,
  an X to leave, big touch targets.
- **The email layer is thoughtfully engineered**: a Resend → SMTP → loud-no-op
  provider chain, and deliberate HTML escaping with a written rationale about a
  pet's name turning a domain-authenticated email into a phishing relay.
- **The security posture is better than the docs suggest.** Several routes
  `docs/APP_MAP.md` lists as unauthenticated now return 401
  (`/api/search/[caseId]/live`, `/api/missions/[id]`, `/api/mission/[id]`).
  `wipe-squads` has a two-step confirm plus a literal type-YES gate, and its API
  re-reads the role from the database rather than trusting the JWT.
- **Link previews work.** Case pages serve the pet's photo as `og:image` with
  correct per-entity titles — the thing that decides whether a shared link helps.
- **Some error states are already right** and can be copied to the broken ones:
  "Case not found" ships a proper card with a way out, and the wrong-password
  login says what happened while staying on brand.
- **The AI that ships is real.** `lib/ai/comparePetPhotos.js` is a genuine Claude
  vision call with a global per-minute cost ceiling, and `/api/ai/analyze-pet`
  calls the API directly.
- **The July gallery's `/join/[missionId]` "Connection Error" is fixed.**

---

## 6. Suggested order

**Before launch (the six blockers).** Every one is a local change.

1. B1 — delete `contact` from the public endpoint; extend the SEC-3 test to it.
2. B4 — delete or query the city-page stats; `noindex` or validate the slugs.
3. B5 — z-index and bottom inset on the mobile case CTA.
4. B2 — move `bcrypt.hash` out of the transaction.
5. B3 — fix the status value and the response shape; add a test.
6. B6 — wire up an error tracker.

**First week.** H1 (CAPTCHA, before the spam arrives), H2, H3, H4, H6, H7,
H8, H10, H11, H12, H13.

**Two questions only the founder can answer.** Both are on public pages, and
both are the kind of claim that is expensive to get wrong:

- `/for-shelters` and the homepage state **"ReunitePets is a nonprofit"**
  (`for-shelters/page.js:93,226`, `page.js:632`). Nothing in the repo
  establishes the entity's legal status, and it is not mentioned in the Terms.
  If it is not a registered nonprofit, this needs to come out.
- Is `support@petrecovery.org` actually monitored? It is the contact of record
  in the Terms and the Privacy Policy.

---

## 7. Checked and found fine, or refuted

Recorded so nobody re-audits them, and so the findings above carry their proper
weight.

**Refuted after checking:**

- *"The case page overflows the phone viewport and scrolls sideways."*
  **Measured false.** At 390×844 on six routes,
  `scrollWidth === clientWidth === 390`, `canScrollX = false`, and `overflow-x`
  is `clip` on both `html` and `body` — exactly what `CLAUDE.md` requires. The
  only element past the right edge is the *closed* mobile drawer, correctly
  parked off-canvas at `right: 690`. Playwright's full-page raster expands to
  include off-canvas fixed elements; that is a capture artifact, and it is also
  what read as "a half-drawn menu bleeding in".
- *"'Wipe All Squad Data' is one unguarded click."* False — two-step confirm
  plus a literal type-YES gate.
- *"The pet edit form has no way to save."* Mostly false — there is a save bar
  that appears once the form is dirty (`pets/[id]/edit/page.js:765`). The real,
  smaller point: on an untouched form the only visible action is the destructive
  one.
- *"Eight routes end in an indefinite spinner."* Only `/alerts/[id]` is
  genuinely broken. `/hub/thread/[slug]`, `/shelter/start` and `/hub/search`
  all render fine on a quiet server; those captures were taken while ~10
  subagents and a browser sweep were hitting one dev server.
- *"`/api/public/missions` is pathologically slow."* My own measurement error —
  13-16 s under that same contention, **0.13 s** on a quiet server. The query is
  a single `findMany` + `count` with an explicit select.

**Checked and fine:**

- The 3 MB `app/lib/uscities.full.json` never reaches the client bundle — only
  two server-side routes import it.
- Structured logging exists and is used (`logEvent` from `@/lib/logging`, in 52
  API route files), alongside ~866 raw console calls.
- `.env.production` contains placeholders only. No live secret is committed.
- The random-value AI modules (`lib/ai/petRecognition.js`,
  `lib/ai/imageMatching.js`) are labelled as mocks by the real implementation's
  own docstring and are reachable only through a session-gated route. Cleanup
  ticket, not a finding.
- `?search=` on `/lost-and-found` is not a bug; the page reads `?q=`.
- Many admin API routes do their own fresh DB role check without using the
  `isAdmin()` helper — so "lacks `isAdmin`" is not by itself a finding.

---

## 8. The gates, as measured

| Gate | Result |
|---|---|
| `npm test` | **Pass** — 51 suites, 591 passed, 10 todo, ~8 s |
| `next build` | **Pass** — compiled successfully, 231/231 static pages, exit 0. Shared First Load JS 87.5 kB, middleware 49.2 kB, heaviest page `/simulator` (146 kB / 237 kB) |
| `npm run lint` | **Does not run** — no ESLint config exists; drops into an interactive prompt |
| `npm audit --omit=dev` | **19 production vulns** — 3 critical, 12 high, 4 moderate |

**What CI actually gates.** Only jest (`ci.yml:83`) and the build (`:110`).
Lint (`:49`), the Playwright e2e suite (`:183`, explicitly "non-blocking") and
`npm audit` (`:214`) are all swallowed with `|| echo`.

**Warm page timings**, quiet dev server (production will be faster; these are
relative signal only):

```
/                    0.86 s      /api/public/missions   0.13 s
/cases/[n]           0.30 s      /api/public/homepage   1.56 s
/lost-and-found      0.16 s
/lost-pet/austin-tx  0.16 s
/shelters            2.12 s   ← slowest; geocodes server-side
```

**On the repo's own docs.** `ROADMAP.md` says "MVP Complete ~95%";
`VISION.md` says "~45%"; `docs/MVP_REALITY_CHECK.md` (Nov 2025) says "~35%".
The code supports none of them cleanly: the *surface* is close to complete —
104 page files, 281 API routes, a build that passes and a green test suite —
while the *operational* readiness is not (no error tracking, no lint, CAPTCHA
unwired, several primary features silently broken). Treat feature completeness
and launch readiness as separate numbers. `docs/APP_MAP.md` is also stale in
places — several routes it lists as unauthenticated are now gated, and the
mobile app has been rewritten from Capacitor to Expo and is a foundation, not
a shippable app. Read it as a map, not as truth.
