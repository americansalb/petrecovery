/**
 * What each pet color means, on every page of the pet site.
 *
 * One meaning per color: red is a lost pet, blue a found pet waiting for
 * its family, green a pet back home, orange a sighting. Before this file
 * a found pet was blue on the Lost & Found map but green on the found-pet
 * form and the Report menu, the same green that meant "home" on the map,
 * and a sighting was amber on the map but blue on the pet's page.
 *
 * Green always comes with a check mark. Red and green look alike to
 * people with red-green colorblindness (about 1 in 12 men), and the
 * check tells a pet that is home from one that is lost without color.
 *
 * Yellow is not a pet color: it is buttons and Rescue Force areas.
 *
 * Keys follow caseStatus() in app/lib/caseLabels.js, plus `seen`. The hex
 * values are for maps and inline styles; the Tailwind classes are written
 * out whole so the class scanner finds them.
 */

export const PET_COLOR = {
  lost: '#dc2626', // red-600
  found: '#0284c7', // sky-600
  home: '#059669', // emerald-600
  seen: '#ea580c', // orange-600
  closed: '#94a3b8', // midnight-400
};

/** Background class for a small status dot or badge. */
export const PET_BG = {
  lost: 'bg-red-600',
  found: 'bg-sky-600',
  home: 'bg-emerald-600',
  seen: 'bg-orange-600',
  closed: 'bg-midnight-400',
};

/** Text class for the same meaning on a white background. */
export const PET_TEXT = {
  lost: 'text-red-700',
  found: 'text-sky-700',
  home: 'text-emerald-700',
  seen: 'text-orange-700',
  closed: 'text-midnight-500',
};

/** A white check mark, for drawing inside a green map pin. */
export const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
