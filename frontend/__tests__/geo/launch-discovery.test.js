const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');

test('the game has its own manifest without pet branding or missing assets', () => {
  const manifest = JSON.parse(read('public/geo/manifest.webmanifest'));
  expect(manifest.name).toBe('Probably Earth');
  expect(manifest.start_url).toBe('/geo');
  expect(manifest.scope).toBe('/geo');
  for (const icon of manifest.icons) expect(fs.existsSync(path.resolve(__dirname, '../../public', icon.src.slice(1)))).toBe(true);
  expect(read('app/geo/layout.js')).toContain("manifest: '/geo/manifest.webmanifest'");
  expect(JSON.stringify(manifest)).not.toMatch(/ReunitePets|cases|dashboard/);
});

test('the public menu is discoverable while private game pages remain noindex by default', () => {
  const menu = read('app/geo/page.js');
  expect(menu).toContain('index: true');
  // The canonical has to be the game's own domain. It used to be spelled
  // out here, which is exactly why every other game page inherited a
  // localhost base and served a dead og:image: the domain was known in
  // one file and nowhere else. Either spelling is fine; what matters is
  // that it resolves to the game's home (share-base.test.js pins that).
  expect(menu).toMatch(/canonical:\s*(?:'https:\/\/probablyearth\.com\/geo'|`\$\{GEO_HOME_URL\}\/geo`)/);
  expect(read('app/geo/layout.js')).toContain('index: false');
  expect(read('app/geo/components/GeoFooter.js')).toContain('href="/geo/privacy"');
});

test('game routes do not register the pet service worker', () => {
  const source = read('app/components/PushNotificationProvider.js');
  expect(source).toContain("pathname === '/geo' || pathname?.startsWith('/geo/')");
  expect(source.indexOf("pathname?.startsWith('/geo/')")).toBeLessThan(source.indexOf('registerServiceWorker();'));
});
