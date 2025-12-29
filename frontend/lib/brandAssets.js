/**
 * Brand Assets - Centralized CDN URLs for logos and mascots
 *
 * All brand imagery should be imported from here to ensure consistency
 * and make future URL changes easy.
 */

const CDN_BASE = 'https://petrescue.b-cdn.net';

export const BRAND_ASSETS = {
  // Sarama mascot - the divine guide (Sanskrit: सरमा, "the fleet one")
  sarama: {
    avatar: `${CDN_BASE}/Logos%20(4).svg`,
    name: 'Sarama',
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
export const SARAMA_AVATAR = BRAND_ASSETS.sarama.avatar;
export const SARAMA_NAME = BRAND_ASSETS.sarama.name;
export const SARAMA_TAGLINE = BRAND_ASSETS.sarama.tagline;

// Legacy aliases (deprecated - use SARAMA_* instead)
export const SURUMAA_AVATAR = SARAMA_AVATAR;
export const SURUMAA_NAME = SARAMA_NAME;
export const SURUMAA_TAGLINE = SARAMA_TAGLINE;
export const LOGO_PRIMARY = BRAND_ASSETS.logos.primary;
export const LOGO_ICON = BRAND_ASSETS.logos.icon;
