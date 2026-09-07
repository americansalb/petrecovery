/**
 * The cosmetics catalog (docs/GEO.md, "Points and cosmetics"): what
 * points buy. Everything here costs nothing to serve. Titles for a
 * rating tier are free once the tier is reached. Ids are stable; they
 * are stored in GeoUnlock and in GeoProfile.equipped.
 */

import { TIERS } from './rating';

export const ITEM_KINDS = Object.freeze({
  pin: 'Pin',
  color: 'Name colour',
  title: 'Title',
  frame: 'Frame',
  reactions: 'Reactions',
});

export const ITEMS = Object.freeze([
  // Pins: the marker you place. `style` is drawn by the guess map.
  { id: 'pin-classic', kind: 'pin', name: 'Classic', price: 0, free: true, style: 'dot', fill: '#facc15', description: 'The yellow dot.' },
  { id: 'pin-ember', kind: 'pin', name: 'Ember', price: 150, style: 'dot', fill: '#f97316', description: 'An orange dot.' },
  { id: 'pin-mint', kind: 'pin', name: 'Mint', price: 150, style: 'dot', fill: '#2dd4bf', description: 'A mint dot.' },
  { id: 'pin-ring', kind: 'pin', name: 'Ring', price: 300, style: 'ring', fill: '#facc15', description: 'A hollow ring.' },
  { id: 'pin-diamond', kind: 'pin', name: 'Diamond', price: 800, style: 'diamond', fill: '#38bdf8', description: 'A sky-blue diamond.' },
  { id: 'pin-star', kind: 'pin', name: 'Star', price: 1500, style: 'star', fill: '#facc15', description: 'A five-point star.' },
  // Name colours, shown in rooms and on the boards.
  { id: 'color-plain', kind: 'color', name: 'Plain', price: 0, free: true, value: '', description: 'White, like everyone.' },
  { id: 'color-flash', kind: 'color', name: 'Flash', price: 200, value: '#facc15', description: 'Yellow.' },
  { id: 'color-sky', kind: 'color', name: 'Sky', price: 200, value: '#38bdf8', description: 'Light blue.' },
  { id: 'color-rose', kind: 'color', name: 'Rose', price: 200, value: '#f472b6', description: 'Pink.' },
  { id: 'color-lime', kind: 'color', name: 'Lime', price: 200, value: '#a3e635', description: 'Green.' },
  { id: 'color-violet', kind: 'color', name: 'Violet', price: 400, value: '#a78bfa', description: 'Purple.' },
  // Titles, shown after the name.
  { id: 'title-none', kind: 'title', name: 'No title', price: 0, free: true, value: '', description: 'Just the name.' },
  { id: 'title-wanderer', kind: 'title', name: 'Wanderer', price: 100, value: 'Wanderer', description: 'A first title.' },
  { id: 'title-navigator', kind: 'title', name: 'Navigator', price: 400, value: 'Navigator', description: 'Finds the way.' },
  { id: 'title-cartographer', kind: 'title', name: 'Cartographer', price: 1000, value: 'Cartographer', description: 'Draws the map.' },
  { id: 'title-globetrotter', kind: 'title', name: 'Globetrotter', price: 2500, value: 'Globetrotter', description: 'Has been everywhere.' },
  { id: 'title-gold', kind: 'title', name: 'Gold', price: 0, value: 'Gold', requires: { tier: 'Gold' }, description: 'Free at Gold on either ladder.' },
  { id: 'title-master', kind: 'title', name: 'Master', price: 0, value: 'Master', requires: { tier: 'Master' }, description: 'Free at Master on either ladder.' },
  { id: 'title-grandmaster', kind: 'title', name: 'Grandmaster', price: 0, value: 'Grandmaster', requires: { tier: 'Grandmaster' }, description: 'Free at Grandmaster on either ladder.' },
  // Frames around the badge on the profile and in rooms.
  { id: 'frame-none', kind: 'frame', name: 'No frame', price: 0, free: true, value: '', description: 'Plain.' },
  { id: 'frame-bronze', kind: 'frame', name: 'Bronze', price: 300, value: '#b45309', description: 'A bronze ring.' },
  { id: 'frame-silver', kind: 'frame', name: 'Silver', price: 600, value: '#94a3b8', description: 'A silver ring.' },
  { id: 'frame-gold', kind: 'frame', name: 'Gold', price: 1200, value: '#facc15', description: 'A gold ring.' },
  // Reaction packs: more emoji in rooms.
  { id: 'reactions-more', kind: 'reactions', name: 'More reactions', price: 250, emoji: ['🤯', '😭', '🧭', '🌍'], description: 'Four more.' },
  { id: 'reactions-party', kind: 'reactions', name: 'Party', price: 250, emoji: ['🎉', '🍕', '🚀', '🐢'], description: 'Four for a good night.' },
]);

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function itemById(id) {
  return BY_ID.get(String(id || '')) || null;
}

/** The one-of-each slots, and what a new profile wears. */
export const SLOTS = Object.freeze(['pin', 'color', 'title', 'frame']);

export function defaultEquipped() {
  return { pin: 'pin-classic', color: 'color-plain', title: 'title-none', frame: 'frame-none' };
}

const tierIndex = (tier) => TIERS.findIndex((t) => t.name === tier);

export function tierAtLeast(tier, wanted) {
  return tierIndex(tier) >= 0 && tierIndex(tier) >= tierIndex(wanted);
}

/** Free, bought, or unlocked by rating tier. `tier` is the best tier across ladders. */
export function canUse(item, { owned = [], tier = 'Bronze' } = {}) {
  if (!item) return false;
  if (item.free) return true;
  if (owned.includes(item.id)) return true;
  if (item.requires?.tier) return tierAtLeast(tier, item.requires.tier);
  return false;
}

/** Whether a profile may buy an item: priced, not owned, not tier-only. */
export function canBuy(item, { owned = [], points = 0 } = {}) {
  if (!item || item.free || item.requires?.tier) return false;
  if (owned.includes(item.id)) return false;
  return points >= item.price;
}

/** Only ids the profile may actually wear, slot by slot, defaults otherwise. */
export function normalizeEquipped(raw, { owned = [], tier = 'Bronze' } = {}) {
  const out = defaultEquipped();
  if (raw && typeof raw === 'object') {
    for (const slot of SLOTS) {
      const item = itemById(raw[slot]);
      if (item && item.kind === slot && canUse(item, { owned, tier })) out[slot] = item.id;
    }
  }
  return out;
}

/** What the screens need to draw a profile's cosmetics. */
export function equippedView(equipped) {
  const e = { ...defaultEquipped(), ...(equipped || {}) };
  const pin = itemById(e.pin) || itemById('pin-classic');
  return {
    pin: { id: pin.id, style: pin.style, fill: pin.fill },
    color: itemById(e.color)?.value || '',
    title: itemById(e.title)?.value || '',
    frame: itemById(e.frame)?.value || '',
  };
}

/** The reactions a profile may send: the base set plus owned packs. */
export function reactionsFor(base, owned = []) {
  const extra = ITEMS.filter((item) => item.kind === 'reactions' && owned.includes(item.id)).flatMap((item) => item.emoji);
  return [...base, ...extra];
}

/** Every reaction any pack could add, for the server's check. */
export function allReactionEmoji(base) {
  return [...base, ...ITEMS.filter((item) => item.kind === 'reactions').flatMap((item) => item.emoji)];
}
