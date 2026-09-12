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
      this.el.setAttribute('data-fake-overlays', String(this.overlays.length));
      this.el.setAttribute('data-fake-circles', String(this.overlays.filter((o) => o instanceof CircleOverlay).length));
    }
    removeOverlays(list) {
      this.overlays = this.overlays.filter((x) => !list.includes(x));
    }
    showItems() {}
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
  window.mapkit = {
    LookAround,
    load: (library) => Promise.resolve(library),
    init(options) {
      options?.authorizationCallback?.(() => {});
    },
    Map,
    Coordinate,
    CoordinateSpan,
    CoordinateRegion,
    Padding,
    Style,
    MarkerAnnotation,
    CircleOverlay,
    PolylineOverlay,
    FeatureVisibility: { Hidden: 'hidden', Visible: 'visible' },
  };
  Map.ColorSchemes = { Light: 'light', Dark: 'dark' };
})();
