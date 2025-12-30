/**
 * Brand Assets - Centralized CDN URLs for logos and mascots
 *
 * All brand imagery should be imported from here to ensure consistency
 * and make future URL changes easy.
 * 
 * FINAL 2025 LOGOS - Updated Dec 2025
 */

const CDN_BASE = 'https://petrescue.b-cdn.net';

export const BRAND_ASSETS = {
  // Sarama mascot - the divine guide (Sanskrit: सरमा, "the fleet one")
  sarama: {
    avatar: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025.svg`,  // Main logo SVG
    avatarPng: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(1).png`,  // Hero PNG
    name: 'Sarama',
    tagline: 'Your Guide Home',
  },

  // PetRecovery logos - FINAL 2025
  logos: {
    primary: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(1).png`,  // Front page hero (PNG)
    icon: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(5).svg`,  // Nav bar & favicon (SVG)
    favicon: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(3).svg`,  // Browser tab
    ogImage: `${CDN_BASE}/ReunitePets%20Official%20Logo%20Final%202025%20(1).png`,  // Social sharing
  },
};

// Convenience exports
export const SARAMA_AVATAR = BRAND_ASSETS.sarama.avatar;
export const SARAMA_AVATAR_PNG = BRAND_ASSETS.sarama.avatarPng;
export const SARAMA_NAME = BRAND_ASSETS.sarama.name;
export const SARAMA_TAGLINE = BRAND_ASSETS.sarama.tagline;

// Logo exports
export const LOGO_PRIMARY = BRAND_ASSETS.logos.primary;
export const LOGO_ICON = BRAND_ASSETS.logos.icon;
export const LOGO_FAVICON = BRAND_ASSETS.logos.favicon;
export const LOGO_OG_IMAGE = BRAND_ASSETS.logos.ogImage;

