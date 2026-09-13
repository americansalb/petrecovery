// Served to the page in place of https://cdn.apple-mapkit.com/... by
// scripts/geo-e2e/run.js. Only the surface the game touches, and enough
// of it that a tap really produces a coordinate: the script game's whole
// answer is a pin, so a map that cannot be tapped tests nothing.
(function () {
  const listeners = (obj) => (obj.__l = obj.__l || {});

  class Coordinate {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }
  class CoordinateSpan {
    constructor(latitudeDelta, longitudeDelta) {
      this.latitudeDelta = latitudeDelta;
      this.longitudeDelta = longitudeDelta;
    }
  }
  class CoordinateRegion {
    constructor(center, span) {
      this.center = center;
      this.span = span;
    }
  }
  class Padding {
    constructor(top, right, bottom, left) {
      Object.assign(this, { top, right, bottom, left });
    }
  }
  class Style {
    constructor(options) {
      Object.assign(this, options || {});
    }
  }
  class MarkerAnnotation {
    constructor(coordinate, options) {
      this.coordinate = coordinate;
      Object.assign(this, options || {});
    }
  }
  class CircleOverlay {
    constructor(coordinate, radius, options) {
      this.coordinate = coordinate;
      this.radius = radius;
      Object.assign(this, options || {});
    }
  }
  class PolylineOverlay {
    constructor(points, options) {
      this.points = points;
      Object.assign(this, options || {});
    }
  }
  class PolygonOverlay {
    constructor(points, options) {
      this.points = points;
      Object.assign(this, options || {});
    }
  }
  class CameraZoomRange {
    constructor(minCameraDistance, maxCameraDistance) {
      Object.assign(this, { minCameraDistance, maxCameraDistance });
    }
  }

  class Map {
    constructor(el) {
      this.el = el;
      this.annotations = [];
      this.overlays = [];
      window.__fakeMaps.push(this);
      el.innerHTML =
        '<div data-fake-mapkit="1" style="position:absolute;inset:0;background:linear-gradient(#1b2a41,#274060);color:#9fb3c8;font:12px monospace;display:flex;align-items:center;justify-content:center">MAPKIT</div>';
      el.style.position = el.style.position || 'relative';
      // A real tap carries a page point; the game converts it. Anything
      // clicked inside the map is treated as a tap at that point.
      el.addEventListener('click', (event) => {
        (listeners(this)['single-tap'] || []).forEach((fn) => fn({ pointOnPage: { x: event.pageX, y: event.pageY } }));
      });
    }
    addEventListener(name, fn) {
      (listeners(this)[name] = listeners(this)[name] || []).push(fn);
    }
    // Page point to coordinate, linear over the element's box. Good
    // enough that clicking the left half really is a western longitude.
    convertPointOnPageToCoordinate(point) {
      const box = this.el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (point.x - box.left) / (box.width || 1)));
      const y = Math.min(1, Math.max(0, (point.y - box.top) / (box.height || 1)));
      return new Coordinate(85 - y * 170, -180 + x * 360);
    }
    addAnnotation(a) {
      this.annotations.push(a);
    }
    addAnnotations(list) {
      this.annotations.push(...list);
      this.el.setAttribute('data-fake-annotations', String(this.annotations.length));
    }
    removeAnnotation(a) {
      this.annotations = this.annotations.filter((x) => x !== a);
    }
    removeAnnotations(list) {
      this.annotations = this.annotations.filter((x) => !list.includes(x));
    }
    addOverlays(list) {
      this.overlays.push(...list);
      this.sync();
    }
    removeOverlays(list) {
      this.overlays = this.overlays.filter((x) => !list.includes(x));
      this.sync();
    }
    // The script round's answer is an area, drawn as one polygon per
    // piece of land, so a scenario that wants to know the reveal really
    // drew the regions counts these.
    sync() {
      this.el.setAttribute('data-fake-overlays', String(this.overlays.length));
      this.el.setAttribute('data-fake-circles', String(this.overlays.filter((o) => o instanceof CircleOverlay).length));
      this.el.setAttribute('data-fake-polygons', String(this.overlays.filter((o) => o instanceof PolygonOverlay).length));
    }
    showItems(items) {
      this.shown = items;
    }
    destroy() {}
  }

  /**
   * Look Around, enough of it for a room to start.
   *
   * A real one loads imagery for a coordinate and fires 'load' or
   * 'error'; the game races several candidates and the first browser to
   * get a 'load' places the round for everyone. This one loads for any
   * coordinate, after a tick, and paints something visible so a
   * screenshot of an Apple round is not a blank rectangle.
   */
  class LookAround {
    constructor(el, coordinate) {
      this.el = el;
      this.coordinate = coordinate;
      window.__fakeLookArounds.push(this);
      el.innerHTML =
        `<div data-fake-lookaround="1" style="position:absolute;inset:0;background:linear-gradient(#2d3f52,#4a6076);color:#dbe7f3;font:14px monospace;display:flex;align-items:center;justify-content:center">LOOK AROUND ${coordinate.latitude.toFixed(3)}, ${coordinate.longitude.toFixed(3)}</div>`;
      el.setAttribute('data-fake-pano', `look-${coordinate.latitude.toFixed(3)}-${coordinate.longitude.toFixed(3)}`);
      setTimeout(() => (listeners(this).load || []).forEach((fn) => fn({})), 20);
    }
    addEventListener(name, fn) {
      (listeners(this)[name] = listeners(this)[name] || []).push(fn);
    }
    destroy() {
      this.el?.removeAttribute?.('data-fake-pano');
    }
  }

  window.__fakeMaps = [];
  window.__fakeLookArounds = [];

  // MapKit answers about the token on the namespace rather than by
  // rejecting init(), and the game listens for it: an origin-locked
  // token or a spent quota is an 'error', a good one is a
  // 'configuration-change'. The script round falls back to its own
  // keyless map on the first, so the harness can play that case by
  // setting window.__fakeMapKitAuth = 'failed' before the page loads.
  const nsListeners = {};
  const fire = (name, event) => (nsListeners[name] || []).forEach((fn) => fn(event));

  window.mapkit = {
    LookAround,
    load: (library) => Promise.resolve(library),
    addEventListener(name, fn) {
      (nsListeners[name] = nsListeners[name] || []).push(fn);
    },
    removeEventListener(name, fn) {
      nsListeners[name] = (nsListeners[name] || []).filter((x) => x !== fn);
    },
    init(options) {
      options?.authorizationCallback?.(() => {});
      const refused = window.__fakeMapKitAuth === 'failed';
      // Apple answers over the network, so never in the same tick.
      setTimeout(() => {
        if (refused) fire('error', { status: 'Unauthorized' });
        else fire('configuration-change', { status: 'Initialized' });
      }, 0);
    },
    Map,
    Coordinate,
    CoordinateSpan,
    CoordinateRegion,
    CameraZoomRange,
    Padding,
    Style,
    MarkerAnnotation,
    CircleOverlay,
    PolylineOverlay,
    PolygonOverlay,
    FeatureVisibility: { Hidden: 'hidden', Visible: 'visible' },
  };
  Map.ColorSchemes = { Light: 'light', Dark: 'dark' };
  Map.MapTypes = { Standard: 'standard', MutedStandard: 'mutedStandard', Satellite: 'satellite', Hybrid: 'hybrid' };
})();
