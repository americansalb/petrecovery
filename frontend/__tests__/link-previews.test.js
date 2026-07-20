/**
 * Link preview (share card) coverage — the rule lives in docs/LINK_PREVIEWS.md.
 *
 * Every publicly shareable route must serve entity-specific OpenGraph tags
 * from a SERVER page.js (generateMetadata), and the main public segments
 * must carry static cards in a layout.js. Client pages can't do either —
 * preview bots don't run JS — so this suite is a static source check:
 * fast, no DB, runs in CI.
 *
 * Adding a new dynamic public route? Either give it generateMetadata
 * (see the recipe in docs/LINK_PREVIEWS.md) or, if it is genuinely
 * private/auth-only, add it to KNOWN_PRIVATE below with a reason.
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'app');

const read = (rel) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(APP_DIR, rel));

/** Routes whose links get shared around — must unfurl as the entity. */
const ENTITY_PAGES = [
  'cases/[caseNumber]/page.js',
  'pets/view/[token]/page.js',
  'missions/[missionNumber]/page.js',
  'reports/[id]/page.js',
  'alerts/[id]/page.js',
  'join/[missionId]/page.js',
  'rescue-forces/[id]/page.js',
  'hub/thread/[slug]/page.js',
  'hub/c/[slug]/page.js',
  'hub/u/[id]/page.js',
  'lost-pet/[location]/page.js',
  'shelters/[id]/page.js',
];

/** Public segments that carry a static card via layout.js. */
const STATIC_SEGMENTS = [
  'lost-and-found',
  'care',
  'rescue-forces',
  'hub',
  'about',
  'advice',
  'shelters',
  'contact',
  'register',
  'login',
  'report',
  'for-shelters',
];

/**
 * Dynamic routes that are deliberately NOT shareable (auth-only or
 * legacy-redirected). A route in this list inherits the root card.
 */
const KNOWN_PRIVATE = [
  'pets/[id]/page.js', // owner-only pet profile
  'pets/[id]/care/page.js',
  'pets/[id]/edit/page.js',
  'pets/[id]/medications/page.js',
  'pets/[id]/medications/new/page.js',
  'pets/[id]/share/page.js',
  'pets/[id]/health/page.js', // owner/caregiver Health Book
  'pets/[id]/today/page.js', // the daily checklist
  'pets/[id]/meds/page.js', // owner/caregiver medication management
  'pets/[id]/profile/page.js', // owner/caregiver pet profile + finder info
  'pets/transfer/[token]/page.js', // emailed adoption-handoff invite; must not unfurl the pet
  'messages/[id]/page.js', // private conversation
  'admin/missions/[missionId]/page.js', // admin-only
  'admin/users/[id]/page.js', // admin-only user detail
  'admin/pets/[id]/page.js', // admin-only pet record
  'missions/[missionNumber]/coordinate/page.js', // auth redirect into mission control
  'rescue-forces/[id]/command-center/page.js', // member surfaces
  'rescue-forces/[id]/divisions/page.js',
  'rescue-forces/[id]/divisions/[divisionId]/page.js',
  'rescue-forces/[id]/mission-control/page.js',
  'rescue-forces/[id]/settings/page.js',
  'communities/[id]/page.js', // legacy; next.config redirects /communities/*
];

function walkPages(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'api') continue; // API routes have no previews
      out.push(...walkPages(path.join(dir, entry.name), relPath));
    } else if (/^page\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(relPath);
    }
  }
  return out;
}

const isClientComponent = (src) => /^\s*['"]use client['"]/.test(src);

describe('link previews (share cards)', () => {
  describe('entity routes serve per-entity metadata', () => {
    test.each(ENTITY_PAGES)('%s', (page) => {
      expect(exists(page)).toBe(true);
      const src = read(page);
      // generateMetadata only runs in server components
      expect(isClientComponent(src)).toBe(false);
      expect(src).toMatch(/export\s+async\s+function\s+generateMetadata/);
    });
  });

  describe('public segments carry a static card', () => {
    test.each(STATIC_SEGMENTS)('%s/layout.js', (segment) => {
      const layout = `${segment}/layout.js`;
      expect(exists(layout)).toBe(true);
      const src = read(layout);
      expect(isClientComponent(src)).toBe(false);
      expect(src).toMatch(/export\s+const\s+metadata|export\s+async\s+function\s+generateMetadata/);
    });
  });

  test('every dynamic route is either shareable (generateMetadata) or known-private', () => {
    const dynamicPages = walkPages(APP_DIR).filter((p) => p.includes('['));
    const missing = dynamicPages.filter((page) => {
      if (KNOWN_PRIVATE.includes(page)) return false;
      const src = read(page);
      if (!isClientComponent(src) && /generateMetadata/.test(src)) return false;
      // A server layout beside the page may also provide the card
      const layout = page.replace(/page\.(js|jsx|ts|tsx)$/, 'layout.js');
      if (exists(layout)) {
        const layoutSrc = read(layout);
        if (!isClientComponent(layoutSrc) && /metadata/.test(layoutSrc)) return false;
      }
      return true;
    });

    if (missing.length) {
      throw new Error(
        `Dynamic routes without link-preview metadata:\n  ${missing.join('\n  ')}\n` +
          'Add generateMetadata (docs/LINK_PREVIEWS.md) or list them in KNOWN_PRIVATE with a reason.'
      );
    }
  });

  test('known-private list only contains routes that still exist', () => {
    const stale = KNOWN_PRIVATE.filter((p) => !exists(p));
    expect(stale).toEqual([]);
  });
});
