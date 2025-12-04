/**
 * Brand Assets - Centralized CDN URLs for logos and mascots
 *
 * All brand imagery should be imported from here to ensure consistency
 * and make future URL changes easy.
 */

const CDN_BASE = 'https://petrescue.b-cdn.net';

export const BRAND_ASSETS = {
  // Surumaa mascot - the friendly guide character
  surumaa: {
    avatar: `${CDN_BASE}/Untitled%20design%20(13).svg`,
    name: 'Surumaa',
    tagline: 'Your Guide Home',
  },

  // PetRecovery logos
  logos: {
    primary: `${CDN_BASE}/Untitled%20design%20(12).svg`,
    icon: `${CDN_BASE}/Logos.svg`,
    alt1: `${CDN_BASE}/Logos%20(1).svg`,
    alt2: `${CDN_BASE}/Logos%20(2).svg`,
  },
};

// Convenience exports
export const SURUMAA_AVATAR = BRAND_ASSETS.surumaa.avatar;
export const SURUMAA_NAME = BRAND_ASSETS.surumaa.name;
export const SURUMAA_TAGLINE = BRAND_ASSETS.surumaa.tagline;
export const LOGO_PRIMARY = BRAND_ASSETS.logos.primary;
export const LOGO_ICON = BRAND_ASSETS.logos.icon;
