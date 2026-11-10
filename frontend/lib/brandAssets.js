/**
 * Brand Assets - the logos and the mascot, from one place.
 *
 * The mark itself is served from public/brand as small PNGs. The CDN's SVG
 * of it is a 3.2 MB traced drawing, and it loaded on every page, under the
 * loading spinner included: on a slow connection nothing could be tapped for
 * fifteen seconds while it came down (measured 2026-11-09). The 192px PNG is
 * 12 KB and covers the navbar at three times its size; the 1024px one is for
 * link previews and the home-screen icon.
 *
 * FINAL 2025 LOGOS - Updated Dec 2025; served locally Nov 2026.
 */

const CDN_BASE = 'https://petrescue.b-cdn.net';
const MARK_SMALL = '/brand/logo-192.png';
const MARK_LARGE = '/brand/logo-1024.png';
// Sarama standing in the vest: the other drawing. The home page's two cards
// used to show one each; a 2026-11-09 change pointed both at the mark.
const SARAMA_STANDING = '/brand/sarama-480.png';
const SARAMA_STANDING_LARGE = '/brand/sarama-1024.png';

export const BRAND_ASSETS = {
  // Sarama mascot - the divine guide (Sanskrit: सरमा, "the fleet one")
  sarama: {
    avatar: MARK_SMALL, // the mark, small (was the 3.2 MB SVG)
    avatarPng: SARAMA_STANDING, // the standing dog (was the same drawing as a 1.9 MB PNG)
    name: 'Sarama',
    tagline: 'Your Guide Home',
  },

  // PetRecovery logos - FINAL 2025
  logos: {
    primary: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(9).svg`,  // Front page hero (Dog Image)
    icon: MARK_SMALL, // Nav bar (Logo)
    favicon: MARK_SMALL, // Browser tab
    ogImage: SARAMA_STANDING_LARGE, // Social sharing (the standing dog, as before, 185 KB instead of 1.9 MB)
  },
};

// Convenience exports
export const SARAMA_AVATAR = BRAND_ASSETS.sarama.avatar;
export const SARAMA_AVATAR_LARGE = '/brand/logo-512.png'; // the mark where it is drawn large (a card), sharp on a retina screen
export const SARAMA_AVATAR_PNG = BRAND_ASSETS.sarama.avatarPng;
export const SARAMA_NAME = BRAND_ASSETS.sarama.name;
export const SARAMA_TAGLINE = BRAND_ASSETS.sarama.tagline;

// Logo exports
export const LOGO_PRIMARY = BRAND_ASSETS.logos.primary;
export const LOGO_ICON = BRAND_ASSETS.logos.icon;
export const LOGO_FAVICON = BRAND_ASSETS.logos.favicon;
export const LOGO_OG_IMAGE = BRAND_ASSETS.logos.ogImage;

