# ReunitePets — the native app

The real, native iOS/Android app. Separate screens from the website, but the
**same backend and data**: same accounts, same pets, same cases. Add something
in the app and it shows on the website, and vice versa.

Built with Expo (React Native) + file-based routing. The website lives in
`../frontend`; this is its own app face on the same engine.

## What's here so far (the foundation)

- **Brand theme** — `src/constants/theme.ts` (the midnight + flash palette from
  the website).
- **Navigation** — bottom tabs (`src/app/(tabs)/`): Home, My Pets, Lost & Found,
  Forces, wrapped in a native stack (`src/app/_layout.tsx`).
- **UI kit** — `src/components/` (Screen, Button, Card, themed text).
- **Data connection** — `src/lib/api.ts` talks to the live backend
  (`https://www.reunitepets.org`). Login + per-screen data come next.

Screens get built one at a time. My Pets / Lost & Found / Forces are
placeholders for now.

## See it on a phone (no Mac, no Xcode)

1. Install the free **Expo Go** app from the App Store / Play Store.
2. On a computer: `cd mobile && npm install`
3. `npx expo start`
4. Scan the QR code with your phone's camera (iOS) or the Expo Go app
   (Android). The app opens on your phone with real native feel.

To later ship it to the App Store / Play Store, Expo's build service (EAS)
produces installable apps — that step is documented when we get there.

## Point it at a different backend (e.g. local dev)

Set `expo.extra.apiBaseUrl` in `app.json`, or leave it on production.
