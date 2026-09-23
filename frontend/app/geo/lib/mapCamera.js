/**
 * Moving a MapKit map's camera without losing the move.
 *
 * MapKit drops any region set while an animated one is still running.
 * Animated, instant or assigned with `map.region =`, the new region is
 * simply lost, and the first animation carries on to where it was
 * going. Measured in a browser: a 40 degree region set 120ms into an
 * animation to 100 degrees left the map at 100.
 *
 * In the game it showed up at the end: the summary's map was framed for
 * the reveal's wide box, the box shrank to half the screen, and the
 * refit for the new size landed while the first framing was still
 * moving. It was dropped, so the first and last answers of the game sat
 * cut off at the map's edges, about one game in three.
 *
 * So a move asked for mid-flight waits for the flight to end, and the
 * last one asked for is the one that happens. If the map comes to rest
 * somewhere else (a resize cut the flight short), the move is made once
 * more, and only once, so a region MapKit cannot show is never chased.
 */

/** Longest a flight is waited for; one that never reports its end has ended. */
export const FLIGHT_MS = 1500;

/**
 * Does the region the map is showing hold the one that was asked for?
 * MapKit fits a region inside the view, so the one it settles on is as
 * big as the one asked for in one direction and bigger in the other,
 * around the same centre.
 */
function shows(current, wanted) {
  if (!current || !wanted) return false;
  const lng = wanted.span.longitudeDelta;
  const lat = wanted.span.latitudeDelta;
  const dLng = Math.abs(((current.center.longitude - wanted.center.longitude + 540) % 360) - 180);
  return (
    current.span.longitudeDelta >= lng * 0.97 &&
    current.span.latitudeDelta >= lat * 0.97 &&
    Math.abs(current.center.latitude - wanted.center.latitude) <= lat * 0.05 + 1e-6 &&
    dLng <= lng * 0.05 + 1e-6
  );
}

export function cameraFor(map, { flightMs = FLIGHT_MS } = {}) {
  let flying = false;
  let wanted = null;
  let retries = 0;
  let timer = 0;

  const fly = () => {
    const { region, animate } = wanted;
    if (animate) {
      flying = true;
      clearTimeout(timer);
      timer = setTimeout(settle, flightMs);
    }
    try {
      if (animate) map.setRegionAnimated(region, true);
      else map.region = region;
    } catch {
      map.region = region;
    }
    if (!animate) wanted = null;
  };

  const settle = () => {
    clearTimeout(timer);
    flying = false;
    if (!wanted) return;
    if (shows(map.region, wanted.region)) {
      wanted = null;
    } else if (retries < 1) {
      retries += 1;
      fly();
    } else {
      wanted = null;
    }
  };

  map.addEventListener?.('region-change-end', settle);

  return {
    /** Move to `region`, now or as soon as the move in flight has ended. */
    move(region, animate = false) {
      wanted = { region, animate };
      retries = 0;
      if (!flying) fly();
    },
    stop() {
      clearTimeout(timer);
      wanted = null;
      map.removeEventListener?.('region-change-end', settle);
    },
  };
}
