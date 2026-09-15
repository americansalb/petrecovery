/**
 * Which country names fit on the screen, and which ones lose.
 *
 * Natural Earth gives every country a label anchor and the zoom its
 * cartographers thought the name should appear at. Plotting all of them
 * and hoping is what the script map used to do, and at world zoom the
 * result was UNITED KINGDOM written across GERMANY written across
 * FRANCE, with ITALY and SPAIN underneath: five countries that are
 * genuinely that close together, and five labels that are not.
 *
 * Real maps solve this by refusing to draw the loser. So does this.
 * Names are offered in order of importance, each one is measured, and a
 * name whose box touches a box already on the map is dropped until the
 * player zooms in far enough for it to fit. Nothing moves and nothing
 * shrinks: a label that is drawn is drawn where it belongs, at the size
 * it belongs, or it is not drawn at all.
 *
 * Pure on purpose. The projection comes in as a function so this can be
 * tested without a map, and so the two maps that use it (Apple and the
 * keyless one) place their names by the same rule.
 */

/**
 * Roughly how wide a label is, in pixels.
 *
 * Measuring text properly means a canvas and a font that has finished
 * loading, and the answer has to be ready before the first frame. The
 * names are one known style, uppercase with letter spacing, so a width
 * per character is close enough: the cost of being a little wide is a
 * name dropped that would just have fitted, and the cost of being
 * narrow is the overlap this exists to prevent. Wide is the safe way to
 * be wrong.
 */
const CHAR_WIDTH = 0.72;
const LINE_HEIGHT = 1.35;

/** The default sizes, matching .wg-country-label in script-round.css. */
export const LABEL_FONT = { big: 13, small: 11 };

export function labelBox(row, point, fontSize) {
  const width = row.n.length * fontSize * CHAR_WIDTH;
  const height = fontSize * LINE_HEIGHT;
  return {
    left: point.x - width / 2,
    right: point.x + width / 2,
    top: point.y - height / 2,
    bottom: point.y + height / 2,
  };
}

function overlaps(a, b, pad) {
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top);
}

/**
 * The names to draw, in the order they were offered.
 *
 * `project(lat, lng)` returns `{ x, y }` in the map's own pixels, or
 * null for a point it cannot place. `width` and `height` are the map's
 * size; anything whose anchor falls outside them by more than `margin`
 * is not on screen and is not competing for space.
 */
export function chooseLabels(rows, { zoom, project, width, height, pad = 3, margin = 60 } = {}) {
  if (!Array.isArray(rows) || typeof project !== 'function') return [];
  const inBand = rows.filter((row) => row.z <= zoom && zoom <= (row.u ?? 12));
  // Most important first, because first offered is first placed. Ties
  // are broken by name so that the same view always draws the same
  // names: a label that flickered in and out as the map settled would
  // read as the map being unsure.
  const ordered = inBand.slice().sort((a, b) => a.z - b.z || a.n.localeCompare(b.n));

  const taken = [];
  const kept = [];
  for (const row of ordered) {
    const point = project(row.y, row.x);
    if (!point) continue;
    if (point.x < -margin || point.y < -margin || point.x > width + margin || point.y > height + margin) continue;
    const box = labelBox(row, point, row.z <= 2 ? LABEL_FONT.big : LABEL_FONT.small);
    if (taken.some((other) => overlaps(box, other, pad))) continue;
    taken.push(box);
    kept.push(row);
  }
  return kept;
}
