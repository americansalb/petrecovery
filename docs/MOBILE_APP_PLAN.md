# The phone in the field: ReunitePets as a native app

How ReunitePets becomes an iOS/Android app **without forking the product
into two codebases**, and how the one thing a phone can do that a website
cannot — *track a rescuer through a dead zone* — gets built properly.

Decision of record (2026-06-14, owner-approved): **Hybrid, one codebase.**
Capacitor wraps the live web app for full parity; native engineering is
spent only where native is required — the rescuer **Field Mode**. A full
React Native rebuild was considered and rejected: it would mean building
and maintaining the entire UI twice, forever, for a small team. See §3.

Companion to PRODUCT_IA_PLAN.md (the "one home, two doors" product) and
NATIVE_APP.md (the original Capacitor setup notes, now partly stale — see §2).

---

## 1. The promise

ReunitePets is "your pet's home, every day and on the worst day." The app
must carry both doors — the every-day Health Book and the worst-day rescue
machinery — at 100% parity, because the people who install it install it
*before* the worst day and live in it after. Parity is not a nice-to-have;
it is the requirement. The hybrid approach exists precisely because it is
the only way a small team delivers full parity and keeps delivering it.

The **"and more"** the owner asked for is Field Mode: a rescuer walking a
search grid for 30+ minutes, often where signal is poor, needs background
GPS, an offline-tolerant surface, and one-handed controls. That is the part
worth doing natively, and the only part.

## 2. Where we actually stand (honest inventory)

The app was scaffolded once and left half-finished. The truth on disk:

| Piece | State |
|---|---|
| `frontend/capacitor.config.ts` | Present. App id `com.reunitepets.app`, name `ReunitePets`. **Server URL is still the placeholder `https://your-app-domain.com`.** Loads from a remote URL (not bundled). |
| `frontend/ios/`, `frontend/android/` | Native projects exist (scaffolded). |
| Capacitor deps | `core/cli/ios/android/app/splash-screen/status-bar` (^8) + community `background-geolocation` (^1.2.26), all in `optionalDependencies`. |
| **`app/lib/nativeGpsService.js`** | **A deprecated stub** — every function returns `false`/`null`. The headline background-GPS feature is documented but **not wired**. This is the central thing to build. |
| `app/lib/gpsService.js` | One-shot browser geolocation only (`getPosition`), by design. No continuous tracking on web. |
| Offline | `app/lib/offline.js` = IndexedDB action queue (`petrecovery_offline`, store `pending_actions`, 30s sync). `app/lib/network.js` = retry/backoff + `OfflineError`. `public/sw.js` = precache + `/offline.html`. **Primitives exist; Field Mode is not yet using them for GPS.** |
| Mobile API | Only `app/api/mobile/config/route.js`. Room to grow. |
| Build target | `next.config.js` → `output: 'standalone'` (a Node server). **The app is NOT statically exportable** (266 API routes, Prisma in 249 files, server `generateMetadata`). The `mobile:build` npm script's `next export` step is stale and would fail. This is *fine* — it confirms the remote-URL webview model below. |

So: not zero, but the defining capability is missing, and the config points
at nothing real.

## 3. Why hybrid (the two-codebases math, settled)

React Native does not use HTML/CSS/Tailwind; it has its own primitives. So
"go native" does **not** port the ~100 pages and ~264 client components —
it rewrites them in a second rendering system and maintains them in
parallel forever. What is and isn't shared:

| Layer | Shared across web + native? |
|---|---|
| Backend: 266 API routes, Prisma, NextAuth | ✅ Written once, serves both |
| Business logic, zod validation, types, constants | ✅ Shareable with effort |
| Design tokens (color, spacing) | ⚠️ Partial, copied |
| **Screens, forms, navigation, maps UI** | ❌ Rewritten and double-maintained |

Since the overwhelming majority of ongoing work is product/UI, "shared
backend" saves less than it sounds. For this team, 2× UI cost is the
failure mode. **Capacitor keeps one codebase; a shipped web feature appears
in the app instantly.** Native effort is reserved for Field Mode (§6),
which carries over even if we ever revisit a native rebuild.

## 4. How the app is actually made (the pipeline)

```
this repo
  → npx cap sync            (copies web config + plugins into ios/ + android/)
  → open in Xcode (on a Mac), sign with the Apple Developer account,
    set bundle id + capabilities (Background Modes: location; Push)
  → run on a real iPhone
  → upload to App Store Connect
  → TestFlight (beta)  →  submit for review  →  App Store
Android mirrors this via Android Studio → Play Console.
```

Two facts that shape everything:

- **Instant updates.** Because the app renders the live site, **web changes
  ship without App Store review.** Only changes to the *native shell* (a new
  plugin, a new permission) require a new build + resubmission. This is the
  hybrid's superpower and the reason parity stays free.
- **The Mac boundary.** All app *code* lives in this repo and is built here.
  The Xcode archive, signing, and upload steps require a Mac with Xcode and
  the owner's Apple credentials — they cannot run in this Linux environment.
  The plan delivers everything up to "open in Xcode," plus exact click-steps.

**App Store risk (Guideline 4.2, "minimum functionality").** Apple can
reject thin website-in-a-box apps. We clear the bar by genuinely using
native APIs — background location for search-and-rescue, push, camera — and
by making the shell feel native (splash, status bar, safe areas, deep
links, haptics). Field Mode is not just the marquee feature; it is also the
App Store justification. Review notes will explain the SAR background-location
use case explicitly.

## 5. Architecture: web-first shell + native Field Mode

```
┌──────────────────────────── Capacitor native shell ───────────────────────┐
│  Loads https://www.reunitepets.org  (the real Next.js app, full parity)    │
│                                                                            │
│  Native bridge (plugins):                                                  │
│   • App / StatusBar / SplashScreen   – feel + deep links                   │
│   • PushNotifications (APNs/FCM)      – maps to existing PushSubscription   │
│   • Camera / Share / Haptics          – native pickers, share sheet        │
│                                                                            │
│  ┌──────────────────────── FIELD MODE (native muscle) ─────────────────┐  │
│  │  background-geolocation → continuous track, even backgrounded        │  │
│  │  offline: SW tile cache + IndexedDB queue (app/lib/offline.js)       │  │
│  │  posts to existing ingest: /api/mapping/track,                       │  │
│  │     /api/mission/[id]/search  → SearchSession / LocationPing /       │  │
│  │     GPSBreadcrumb / GridCell                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

The shell is thin and stable; the website is the app. Field Mode is the one
place we write real native-bridged code and harden for offline.

## 6. Field Mode — the deep dive (the "and more")

The data spine already exists; we are building the missing **source** and
the **surface**.

**6a. Native GPS source.** Replace the `nativeGpsService.js` stub with a real
`@capacitor-community/background-geolocation` integration:
- `isNative()` returns true under Capacitor; web keeps the one-shot fallback.
- Continuous watcher with a foreground-service notification (Android) and
  "Always" authorization (iOS), per `capacitor.config.ts` (already declares
  `locationAuthorizationRequest: 'Always'`).
- Emits `{lat, lng, accuracy, speed, heading, altitude, timestamp}` — the
  exact shape `LocationPing` / `GPSBreadcrumb` already store.

**6b. Offline tolerance.** Rescuers hit dead zones; the remote-URL model
fails offline, so Field Mode gets its own offline story built on what's here:
- Cache the Field Mode UI + map tiles in `sw.js` (extend `PRECACHE_URLS`;
  add a tile-cache strategy).
- Queue every ping/sighting via `app/lib/offline.js` (`queueAction`), drain
  on reconnect using `app/lib/network.js` retry/backoff. The IndexedDB store
  and 30s sync loop already exist; Field Mode becomes its biggest consumer.
- Escalation path if SW caching proves too fragile: bundle Field Mode as a
  small offline-first screen *inside* the Capacitor app (not the remote URL).
  Recorded as a fallback, not the starting point.

**6c. The rescuer surface.** A one-handed, high-contrast, battery-aware
screen: big Start/Pause/End, live track polyline, "mark area searched,"
quick sighting capture (native camera + GPS stamp), and a coverage view.
Everything writes through the existing endpoints (`/api/mapping/track`,
`/api/mission/[id]/search`, `/api/missions/[id]/coverage`) into
`SearchSession`, `LocationPing`, `GPSBreadcrumb`, `SearchArea`, `PetSpotting`,
`GridCell` — so mission-control on the web reflects field activity live, in
both directions (PRODUCT_IA / HEALTH_BOOK_V2 P4: "the record that rescues").

## 7. Plugins / dependencies to add

Present already: `background-geolocation`, core, cli, ios, android, app,
splash-screen, status-bar. **To add** (move Capacitor deps to regular deps,
since the app now genuinely ships native):

- `@capacitor/push-notifications` (APNs/FCM → existing `PushSubscription` /
  `PushNotificationLog` backend; web `web-push` stays for browsers)
- `@capacitor/camera` (sighting photos)
- `@capacitor/geolocation` (one-shot, complements background plugin)
- `@capacitor/preferences` (small native key/value, e.g. session token)
- `@capacitor/network` (online/offline signal for the sync loop)
- `@capacitor/share`, `@capacitor/haptics` (native share sheet, feedback)

## 8. Phased plan

**Phase 1 — A real app in your hand (shell + parity).**
- Point `capacitor.config.ts` at the production URL; wire `App` (deep links
  so shared pet/mission links open in-app), `StatusBar`, `SplashScreen`,
  safe-area insets. Re-add native plugins (webpack already externalizes them).
- Native push: register device, route to existing notification backend.
- Output: a TestFlight build that is 100% of the site, installable on the
  owner's iPhone. *Milestone: you hold ReunitePets and use every feature.*

**Phase 2 — Field Mode (native muscle).**
- Un-stub `nativeGpsService.js` with real background geolocation (§6a).
- Build the rescuer surface (§6c) wired to existing ingest endpoints/models.
- Offline cache + sync queue on top of `offline.js` / `network.js` / `sw.js`
  (§6b).
- Permission + battery UX; foreground-service notification copy.

**Phase 3 — Polish & store submission.**
- Native camera/share/haptics; final icon + splash; deep-link coverage.
- iOS privacy manifest + App Store privacy labels (location, photos, etc.);
  screenshots; review notes justifying background location.
- Android parity pass (manifest permissions already listed in NATIVE_APP.md).
- Submit to App Store review and Play Console.

**Phase 4 — Iterate.**
- Web features flow into the app automatically. Native shell is rebuilt and
  resubmitted only when a plugin/permission changes.

## 9. Risks & open questions

- **4.2 rejection** — mitigated by genuine native features (§4). Have a
  fallback narrative ready (Field Mode is irreducibly native).
- **iOS "Always" location prompt** — Apple scrutinizes it; the SAR use case
  is legitimate but the prompt copy and the in-app "why" screen matter.
- **Offline robustness** — start with SW + IndexedDB; escalate to a bundled
  Field Mode screen only if needed (§6b).
- **Session/auth in the webview** — confirm NextAuth cookies persist in the
  Capacitor WKWebView across cold starts; `@capacitor/preferences` as backup.
- **Version skew** — Capacitor core/plugins at ^8; verify the community
  background-geolocation plugin matches the installed Capacitor major.
- **Open product question** — does Field Mode also serve the every-day door
  (e.g., "walk logging" feeding the Health Book), or is it rescue-only for v1?

## 10. What can be done where

- **In this repo / by the assistant:** all Capacitor config, the native GPS
  service, Field Mode UI, offline sync, mobile API endpoints, plugin wiring,
  `cap sync`-ready state, and exact Xcode/Android Studio steps.
- **On the owner's Mac, with the Apple account:** open in Xcode, sign, set
  capabilities, archive, upload to TestFlight/App Store. (No Xcode on Linux.)

---

*Plan of record. Build order is §8; the architecture it commits to is §5;
the decision it rests on is the header. Update this doc as phases land.*
