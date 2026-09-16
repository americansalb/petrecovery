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
  /**
   * A custom annotation: a coordinate and a factory that builds the DOM
   * element for it. The script map writes the country names with these,
   * so the element is really built and really put on the page, which is
   * what lets a scenario check what the map does and does not name.
   */
  class Annotation {
    constructor(coordinate, factory, options) {
      this.coordinate = coordinate;
      Object.assign(this, options || {});
      try {
        this.element = factory ? factory(coordinate, options) : null;
      } catch {
        this.element = null;
      }
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
    removeEventListener(name, fn) {
      listeners(this)[name] = (listeners(this)[name] || []).filter((x) => x !== fn);
    }
    // Page point to coordinate, linear over the element's box. Good
    // enough that clicking the left half really is a western longitude.
    convertPointOnPageToCoordinate(point) {
      const box = this.el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (point.x - box.left) / (box.width || 1)));
      const y = Math.min(1, Math.max(0, (point.y - box.top) / (box.height || 1)));
      return new Coordinate(85 - y * 170, -180 + x * 360);
    }
    // Where a coordinate lands on the page, for the region the map is
    // actually looking at. The script map asks for this to work out
    // which country names have room to be drawn, and names are only
    // drawn when the whole visible set fits, so a fake that ignored the
    // region would answer for the whole world at every zoom and never
    // show a name.
    //
    // The tap conversion below deliberately stays on the plain world
    // mapping: scenarios click at fixed pixels and assert on the
    // distance that produces, and those numbers are not what this is
    // testing.
    convertCoordinateToPointOnPage(coordinate) {
      const box = this.el.getBoundingClientRect();
      const center = this.region?.center || { latitude: 20, longitude: 0 };
      const span = this.region?.span || { latitudeDelta: 170, longitudeDelta: 360 };
      return {
        x: box.left + ((coordinate.longitude - center.longitude) / span.longitudeDelta + 0.5) * box.width,
        y: box.top + ((center.latitude - coordinate.latitude) / span.latitudeDelta + 0.5) * box.height,
      };
    }
    addAnnotation(a) {
      this.addAnnotations([a]);
    }
    addAnnotations(list) {
      this.annotations.push(...list);
      for (const a of list) if (a?.element) this.el.appendChild(this.place(a));
      this.el.setAttribute('data-fake-annotations', String(this.annotations.length));
    }
    // Real MapKit puts a custom annotation's element where its
    // coordinate is. Doing the same here is the inverse of the tap
    // conversion below, and it is what makes a screenshot of a fake map
    // worth looking at: country names land on their countries instead
    // of stacking up in the corner.
    place(a) {
      const el = a.element;
      el.style.position = 'absolute';
      el.style.left = `${((a.coordinate.longitude + 180) / 360) * 100}%`;
      el.style.top = `${((85 - a.coordinate.latitude) / 170) * 100}%`;
      el.style.transform = 'translate(-50%, -50%)';
      return el;
    }
    removeAnnotation(a) {
      this.removeAnnotations([a]);
    }
    removeAnnotations(list) {
      this.annotations = this.annotations.filter((x) => !list.includes(x));
      for (const a of list) a?.element?.remove?.();
      this.el.setAttribute('data-fake-annotations', String(this.annotations.length));
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
      this.panoId = `look-${coordinate.latitude.toFixed(3)}-${coordinate.longitude.toFixed(3)}`;
      window.__fakeLookArounds.push(this);
      el.innerHTML =
        `<div data-fake-lookaround="1" style="position:absolute;inset:0;background:linear-gradient(#2d3f52,#4a6076);color:#dbe7f3;font:14px monospace;display:flex;align-items:center;justify-content:center">LOOK AROUND ${coordinate.latitude.toFixed(3)}, ${coordinate.longitude.toFixed(3)}</div>`;
      el.setAttribute('data-fake-pano', this.panoId);
      // Which view the container currently belongs to. The pane builds
      // the view it keeps at the same coordinate as the one it tried,
      // so the id alone cannot tell them apart.
      el.__fakeOwner = this;
      setTimeout(() => (listeners(this).load || []).forEach((fn) => fn({})), 20);
    }
    addEventListener(name, fn) {
      (listeners(this)[name] = listeners(this)[name] || []).push(fn);
    }
    /**
     * Every view of a round is built in the same container, and the
     * pane opens the one it keeps before dropping the one it tried. So
     * only clear the marker if it is still this view's, or tidying up a
     * dead view erases the live one and the round looks like it never
     * opened.
     */
    destroy() {
      if (this.el && this.el.__fakeOwner === this) {
        this.el.removeAttribute('data-fake-pano');
        this.el.__fakeOwner = null;
      }
    }
  }

  window.__fakeMaps = [];
  window.__fakeLookArounds = [];
  /**
   * Zoom the last map built, by narrowing the span it is looking at.
   *
   * The script map works out its zoom from the region's longitude
   * delta, and country names are only drawn once the whole visible set
   * fits, which on a world view it never does. A scenario that wants to
   * see names has to zoom in first, the way a player would.
   */
  window.__fakeZoom = (longitudeDelta) => {
    const map = window.__fakeMaps[window.__fakeMaps.length - 1];
    if (!map) return;
    map.region = {
      center: map.region?.center || new Coordinate(20, 0),
      span: { latitudeDelta: longitudeDelta / 2, longitudeDelta },
    };
    (listeners(map)['region-change-end'] || []).forEach((fn) => fn({}));
  };

  // MapKit answers about the token on the namespace rather than by
  // rejecting init(), and the game listens for it: an origin-locked
  // token or a spent quota is an 'error', a good one is a
  // 'configuration-change'. The script round falls back to its own
  // keyless map on the first, so the harness can play that case by
  // setting window.__fakeMapKitAuth = 'failed' before the page loads.
  const nsListeners = {};
  const fire = (name, event) => (nsListeners[name] || []).forEach((fn) => fn(event));

  // MapKit's own shape, copied from the bundle rather than imagined.
  //
  // The game loads cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js. On
  // core.js NOTHING is on the namespace until the library carrying it
  // has been loaded: every member is a getter that throws
  //
  //     get LookAround(){throw gS("LookAround",["look-around"])}
  //
  // and load(['map', ...]) fetches the chunks, appends to a real
  // loadedLibraries array, and swaps the real values in.
  //
  // This fake used to be far kinder than that, and it is why the same
  // bug shipped three times. It handed out a working LookAround on the
  // first tick, so the harness passed while every real player got
  // "Apple Look Around did not load". A fake more capable than the SDK
  // cannot fail, and a test that cannot fail is not a test.
  //
  // So it now refuses exactly what Apple refuses. A library the game
  // forgets to ask for is a thrown error here, in the harness, rather
  // than a dead round on the live site.
  const LIBRARY_OF = {
    Map: 'map',
    Coordinate: 'map',
    CoordinateSpan: 'map',
    CoordinateRegion: 'map',
    CameraZoomRange: 'map',
    Padding: 'map',
    Style: 'map',
    FeatureVisibility: 'map',
    Annotation: 'annotations',
    MarkerAnnotation: 'annotations',
    CircleOverlay: 'overlays',
    PolylineOverlay: 'overlays',
    PolygonOverlay: 'overlays',
    LookAround: 'look-around',
  };
  const REAL = {
    Map,
    Coordinate,
    CoordinateSpan,
    CoordinateRegion,
    CameraZoomRange,
    Padding,
    Style,
    FeatureVisibility: { Hidden: 'hidden', Visible: 'visible' },
    Annotation,
    MarkerAnnotation,
    CircleOverlay,
    PolylineOverlay,
    PolygonOverlay,
    LookAround,
  };
  // How long the chunks take to arrive. Non-zero on purpose: code that
  // reads a member in the same tick as load() gets the real throw.
  const LOAD_MS = Number(window.__fakeLibraryDelayMs ?? 120);
  const loadedLibraries = [];

  window.mapkit = {
    loadedLibraries,
    /**
     * The real one on core.js: takes an array, throws on a name it does
     * not know, and appends to loadedLibraries once the chunk lands.
     */
    load(names) {
      const list = typeof names === 'string' ? [names] : names;
      if (!Array.isArray(list)) throw new Error('[MapKit] mapkit.load() expects an array of library names.');
      const known = ['map', 'annotations', 'overlays', 'services', 'geojson', 'user-location', 'look-around', 'full-map', 'legacy'];
      for (const name of list) {
        if (!known.includes(name)) throw new Error('[MapKit] Unknown library: ' + name);
      }
      setTimeout(() => {
        for (const name of list) if (!loadedLibraries.includes(name)) loadedLibraries.push(name);
        fire('load', { libraries: list.slice() });
      }, LOAD_MS);
    },
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
  };

  // Every member behind the library that carries it, with Apple's own
  // sentence on the way out.
  for (const [name, library] of Object.entries(LIBRARY_OF)) {
    Object.defineProperty(window.mapkit, name, {
      configurable: true,
      enumerable: false,
      get() {
        if (!loadedLibraries.includes(library)) {
          throw new Error(`[MapKit] mapkit.${name} is available after loading the following library: ${library}.`);
        }
        return REAL[name];
      },
    });
  }

  Map.ColorSchemes = { Light: 'light', Dark: 'dark' };
  Map.MapTypes = { Standard: 'standard', MutedStandard: 'mutedStandard', Satellite: 'satellite', Hybrid: 'hybrid' };
})();
