# Link Previews (Share Cards)

**The rule: every link a user might paste into a chat must unfurl with the
thing it points to — the pet, the mission, the squad, the thread — never the
generic site logo.**

iMessage, WhatsApp, Slack, and Facebook build their preview cards from the
OpenGraph/Twitter tags in the **initial HTML**. They do not run JavaScript.
A `'use client'` page therefore *cannot* set its own preview — it inherits the
site-wide logo card from `app/layout.js`. This is exactly the bug class where
"the medication share link previews as the mascot."

Enforced by `frontend/__tests__/link-previews.test.js` (runs in CI). If you add
a dynamic public route without metadata, that test fails and points you here.

## How to add a preview to a route

All helpers live in `frontend/app/lib/shareMetadata.js`.

### Entity pages (`/things/[id]`)

The page must be a **server component**. If the UI is client-side (it usually
is), split it: move the existing `page.js` to `<Name>Client.js` and create a
thin server `page.js`:

```js
import prisma from '@/app/lib/prisma';
import { buildShareMetadata, genericShareMetadata, shareImage } from '@/app/lib/shareMetadata';
import ThingPageClient from './ThingPageClient';

export async function generateMetadata({ params }) {
  try {
    const thing = await prisma.thing.findUnique({
      where: { id: params.id },
      select: { name: true, photoUrl: true /* only what the card needs */ },
    });
    if (!thing) return genericShareMetadata(); // never leak existence
    return buildShareMetadata({
      title: `${thing.name} | ReunitePets`,
      description: '…one human sentence about this entity…',
      image: shareImage(thing.photoUrl),
      canonical: `/things/${params.id}`,
      index: false, // true ONLY for pages that should rank in search
    });
  } catch (error) {
    console.error('Error generating thing metadata:', error);
    return genericShareMetadata();
  }
}

export default function ThingPage({ params }) {
  return <ThingPageClient params={params} />; // pass params only if the client used the prop
}
```

Mission-shaped routes (anything backed by a `Case`) should not hand-roll copy:
use `missionWhere`, `missionShareSelect`, and `missionShareMetadata` — they
handle LOST vs FOUND wording, the `join` variant, city extraction, and photo
fallback. See `app/missions/[missionNumber]/page.js` for the 20-line version.

### Static public segments (`/about`, `/lost-and-found`, …)

Client pages can't export `metadata`, but a tiny server `layout.js` in the
segment can:

```js
import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Lost & Found Pets | ReunitePets',
  description: 'Browse active lost and found pet reports near you…',
  index: true,
});

export default function Layout({ children }) {
  return children;
}
```

Child entity pages override the card automatically; the layout is just the
segment default.

## House rules

- **Photos beat logos.** Use the entity's photo via `shareImage()`; it falls
  back to the official logo only when there is no photo.
- **Absolute image URLs.** `buildShareMetadata` sets `metadataBase` from
  `NEXT_PUBLIC_BASE_URL`; pass paths or URLs, never `localhost` literals.
- **Not-found never leaks.** Invalid ids/tokens return `genericShareMetadata()`
  — same card whether the entity exists or not (matters for tokenized links).
- **`index` is an explicit decision.** Default is `false` (preview-only).
  `true` is for pages meant to rank: the canonical case page while active,
  hub threads/categories, the static public segments, `/lost-pet/<location>`.
  Tokenized and auth-adjacent pages stay `noindex`.
- **Legacy redirect routes still need cards.** `/missions/<n>`, `/reports/<id>`,
  `/alerts/<id>` client-redirect humans, but bots read their HTML — they carry
  the full mission card.
- **Keep the `select` minimal.** `generateMetadata` runs on every uncached
  page load; fetch only the card's fields.
- **New private route?** Add it to `KNOWN_PRIVATE` in
  `frontend/__tests__/link-previews.test.js` with a reason comment.

## Cache reality check

Messengers cache previews per-URL on the **sender's** device, sometimes for
days. When verifying a fix, append a throwaway query (`?v=2`) or use a fresh
URL; old sends keep their old cards forever.

## Verifying locally

```bash
curl -s http://localhost:3000/cases/AUS-2026-0001 | grep -o '<meta property="og:[^>]*>'
```

Or paste the URL into https://www.opengraph.xyz / Slack to see the rendered card.
