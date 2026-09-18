# Probably Earth — Claude handoff
Prepared 2026-09-18. This is a development handoff, NOT a launch sign-off.

## Immediate instruction and release status
The owner explicitly requested: “Can you merge what we have at a natural pause and create a handoff? Claude is gonna finish it from here.”
This supersedes the earlier instruction not to merge before complete launch verification. Merge PR291 only after its current required checks pass; do not describe the merge as proof the game is ready.
Repository: americansalb/petrecovery. Default/release branch: **pet_main** (not main).
PR: https://github.com/americansalb/petrecovery/pull/291
Working branch: codex/launch-account-flow.
Read the PR for the final merge SHA and current CI/deployment status. This document is committed before merging, so it cannot independently certify that later event.

**No new spending is authorized.** Do not buy staging, SMS, infrastructure, or paid services. A paid preview was proposed and rejected; it is not a prerequisite for continuing.

## Product acceptance checklist
- Free guest solo play, then prompt to create an account for cloud saves or multiplayer. No payment.
- Quick username + email OR phone signup. Preserve the current game and return to the intended action; do not strand the player on a profile page.
- Actual message delivery and working verification/recovery, not just a successful HTTP response.
- Login persists at least a week. Current implementation uses a 90-day session.
- Saved games survive refresh, login, subsequent visits and cross-device use; handle conflicting checkpoints safely.
- Choose Solo/Multiplayer, then Street/Script. Multiplayer uses Duel; no Classic versus Duel choice.
- Automatic matchmaking, complete matches, private invitations, rematches, disconnection/reconnection.
- Script's core is geographic guessing and learning the polygons of regions where languages are spoken. **Do not replace this with naming a language.** The owner rejected that prototype. Make one continuous game screen, not a series of pages.
- Intuitive minimal UI with little dependence on English. Earth colors: actual ocean blue, clay/terracotta and green. Plain copy, meaningful country flags instead of random compass icons.
- Desktop and mobile QA, including narrow screens, keyboard actions, errors, loading and empty states.
- Leagues: Wood below top70%; Copper top70%; Silver top45%; Gold top25%; Sapphire top10%; Meteorite top five.
- Five placement matches. Current Meteorite defaults require at least 20 rated matches and 80% average available points, in addition to top-five rank. The owner wanted an accuracy floor but did NOT personally select these numerical defaults. They are centralized and tunable.
- Separate Street and Script ratings, authoritative score/accuracy, no sixth Meteorite through ties.

## Verified evidence at the pause
Latest full local regression: **169 suites, 1,608 passed, 10 existing todos**, including real isolated PostgreSQL release checks. Todos are pet finder-funnel contracts, not skipped game tests.
Production build passed with the fresh-browser seat recovery changes. The final CSS-only standings tweak was browser-checked after that build; final-head CI builds it again. Changed JavaScript files lint cleanly. No git whitespace errors.
Prior pushed head e734b08afecdfb6b8333c8220eb9843552ea2832 passed CI run 35381713403: unit, PostgreSQL, lint, security and build. E2E job is skipped on these PR runs; do not call this hosted browser verification.

Browser/HTTP journeys:
1. Script matchmaking: browser account signup from Find match, original tab automatically resumed the queue after verification, independent authenticated HTTP opponent matched. Room WMEVMG completed all five rounds. Scores 2612/1727, health5637/4759, +105 rating, placement1/5, 89 cosmetic points. Mid-match reload retained seat and health.
2. Private Script invite: room6UX5YK, three rounds/three-minute timer, peer joined by code. Clue + geographic map visible together at mobile390x844 and320x568 and desktop1280x800.
3. Real interruption: browser placed a pin; local server was stopped during round3. UI announced connection loss while retaining seat, health and pin. Restarting against the same PostgreSQL DB recovered automatically; submitted preserved pin; completed match. Final health5739/5363, rating +/-133, 33 cosmetic points.
4. Fresh-browser storage: opening that finished match on localhost3034 initially showed only “This game is over.” Fixed server-authenticated seat recovery and client caching. Production build now restores the same player's full final standings, rating and award without joining again. Tests reject anonymous, unrelated-account, switched-account and explicitly left-seat recovery.
5. Mobile final standings: name overflow overlapped health. CSS now preserves the flex name container and protects score width. Browser390px measurement shows a10px gap and no name/score overlap. Do not claim a new320px recheck of this particular tweak: the viewport command targeted a different active tab.
6. Earlier actual Street solo browser checks used real Apple imagery: completed desktop and mobile games, persisted guesses/results across reload, fixed moving Guess button and hidden zero-size Apple map rendering. Latest complete **Street multiplayer mobile match remains unverified**.
7. Production signup email actually reached a temporary inbox after correcting the sender. The OLD live callback created a session but redirected to https://localhost:10000/geo/me and guest20points became0. Draft includes public-origin and account-binding fixes plus regressions, but hosted corrected flow still needs testing.

## Last changes and code locations
- app/lib/geo/server/roomAccess.js, api/geo/rooms/[code]/route.js, geo/lib/useRoom.js: recover existing account-bound seats with stable server-derived token when browser storage is absent. No creation, token rotation or left-seat recovery. No-store responses. Tests: geo-room-account-boundary and room-reconnect-hook.
- geo/components/RoomClient.js, geo/match.css: always-visible Script map and clue, locked map retained; Street keeps its drawer. Script results link to Script leaderboard.
- geo/components/rooms/RoomPanels.js: match results; geo/match.css final standings fix.
- geo/error.js: game-specific error boundary; missing chunks cause full same-page reload, not a repeated rejected dynamic import. No false operator-notified claim.
- geo/components/rooms/Matchmaker.js:10s request timeout, retain uncertain ticket, recover by polling rather than duplicate joining. profile.ensureProfile accepts AbortSignal.
- app/lib/geo/clientAddress.js + middleware.js + both rate limiters: one trusted-client-address implementation. Configured trusted header missing => shared unknown bucket, no fallback to attacker-controlled forwarding chain. Auth limits ignore arbitrary profile/seat IDs.
- Actual built middleware probe: same trusted IP + forged rotating XFF/XReal/profile headers yields400 five times, then429 twice; separate trusted IP still400. No emails sent by that invalid-body probe.
- Server ratings use transactional locks, stable match result claims and accuracy counters. Schema adds scoredPoints/scoredRounds to GeoRating and GeoSeasonRating.
- All file paths in this section are relative to frontend/.

## Hosting and email: actual state
Correct existing Render service: **srv-d46g0j2li9vc73fdu7u0**, petrecovery, Kevin's workspace, NodeStarter.
https://dashboard.render.com/web/srv-d46g0j2li9vc73fdu7u0
It serves Probably Earth and the pet site from pet_main, sharing production resources. Do not point it at an experimental branch or replace its database without a separate explicit decision.
Before handoff merge, last verified live commit was9715c45cc54be2716619c51bda8eda49e4242bf3, deploymentdep-dammicp42hec739mua8g.
Merge may trigger existing auto-deploy. Inspect its actual status; neither a green GitHub build nor successful Render startup proves migrations or player journeys worked.

Email sender fixed and deployed previously:
GEO_MAIL_FROM=Probably Earth <noreply@reunitepets.org>
Existing verified sending domain; existing Resend service. No secrets copied, rotated or committed.
Owner requests a **temporary test inbox**, not their personal email.
Earlier temporary inbox was colline8@uberip.com at mail.tm; access may expire. Its sign-in token is spent. Do not reuse it as a fresh verification.

Saved this turn using Render “Save only”:
RATELIMIT_TRUSTED_IP_HEADER=cf-connecting-ip
No deployment was triggered by this save. Verify activation after merge/deploy and live spoof resistance. Render documents Cloudflare inbound protection; CF-Connecting-IP is its single client-address header.
Production has Apple signing config and email config, but **no configured SMS/Twilio provider and no ERROR_WEBHOOK_URL**.
An unanswered user question asks whether launch should be email-only or use an existing SMS service. Do not spend money or silently claim phone delivery.
Error alerts need a real owner-approved destination; stdout/EventLog is not operator notification.

Schema:
npm build runs prisma generate, scripts/db-sync.js, next build.
npm start runs scripts/boot.js, attempts schema sync and additive repair, then starts even if sync failed.
Therefore inspect logs and verify actual columns/endpoints after deployment. Never use --accept-data-loss. Production DB is shared with pet functionality.
Use tests in __tests__/db-additive.test.js and geo/postgres-release.test.js; a startup-success banner alone is not migration proof.

## Remaining work, in priority order
1. Inspect post-merge Render deployment, schema logs, health and correct live commit. If failing, preserve old healthy deployment; do not weaken security or destroy data.
2. Real temporary-inbox signup on corrected hosted build: guest game -> signup -> received email -> public-domain callback -> same game/score. Test original tab and verification tab, spent/expired links and logout.
3. Cross-device/session hosted cloud-save and existing-seat recovery; verify secure persistent cookies, account-switch isolation and no progress loss.
4. Full actual Street multiplayer on desktop/mobile with Apple imagery, including queue, five rounds, map drawer, rating/results, reload, disconnect/reconnect and rematch. Script has stronger local end-to-end evidence, but still needs hosted QA.
5. Final mobile/desktop screen inventory and visual pass. Check long names/cosmetic titles, small heights, dialogs, keyboard and no overflow.
6. Resolve email-only versus existing SMS service with owner. If phone retained, prove real delivery and recovery.
7. Configure/verify alert destination with owner, review deployment rollback and operational limits.
8. Only after these pass, declare launch-ready. Test counts and merge are not substitutes.

## Local continuation (only if Claude is on this machine)
Repository:
 /Users/kevinthakkar/Documents/Codex/2026-09-17/github-plugin-github-openai-curated-remote-7/work/petrecovery-git
The worktree/index is older than remote and shows MANY modifications/untracked files already published. **Do not reset/clean it or blindly commit that whole status.**
Use a fresh clone of pet_main after confirmed merge, or compare actual file contents with the remote. The read-only work/release-tree.cjs helper includes untracked published files and excludes generated next-env.d.ts. Remote refs were fetched to e734b08 before the last handoff commit.
Node binary:
 /Users/kevinthakkar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
Frontend deps already installed. Typical checks:
 node node_modules/jest/bin/jest.js --ci --maxWorkers=2 --silent
Set **GEO_PG_TEST_URL** for isolated PostgreSQL tests (not GEO_TEST_DATABASE_URL).
Synthetic local PostgreSQL is on127.0.0.1:55439, databaseprobablyearth_launch_qa. Its connection configuration is in the existing local runtime commands, not production credentials.
Local3032: current development copy under work/pg-runtime/frontend, isolated DB. A public localhost-only Apple token was refreshed around18:49UTC and lasts one hour.
Local3034: production-mode build under work/petrecovery-git/frontend, isolated DB; final CSS tweak is newer than that build.
Local3033: older Script preview, not current release.
QA accounts are synthetic @example.test. Those local development links do not prove email delivery.
Current browser preview room6UX5YK on3032. Render and mail.tm tabs were left for handoff. Test data is isolated; nothing material was deleted.
No Claude task has been created or messaged automatically. The owner will hand this document to Claude.

