// Served to the page in place of https://maps.googleapis.com/maps/api/js by
// scripts/geo-e2e/run.js. Only the surface the game touches.
(function () {
  const listeners = (obj) => (obj.__l = obj.__l || {});
  function addListener(obj, name, fn) { (listeners(obj)[name] = listeners(obj)[name] || []).push(fn); return { remove() {} }; }
  function fire(obj, name, ev) { (listeners(obj)[name] || []).forEach((fn) => fn(ev)); }

  class LatLng { constructor(lat, lng) { this._lat = lat; this._lng = lng; } lat() { return this._lat; } lng() { return this._lng; } }
  class LatLngBounds { constructor() { this.items = []; } extend(p) { this.items.push(p); return this; } isEmpty() { return this.items.length === 0; } }
  class StreetViewPanorama {
    constructor(el, opts) { this.el = el; this.opts = opts; this.pov = opts.pov || { heading: 0, pitch: 0 }; this.zoom = 0; this.pano = opts.pano || ''; window.__fakePanos.push(this); this.render(); }
    render() { this.el.innerHTML = `<div data-fake-pano="${this.pano}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(#274060,#1b2a41);color:#9fb3c8;font:14px monospace">STREET VIEW ${this.pano} heading ${Math.round(this.pov.heading)}</div>`; }
    setPano(id) { this.pano = id; this.render(); }
    setPov(pov) { this.pov = pov; this.render(); fire(this, 'pov_changed'); }
    getPov() { return this.pov; }
    setZoom(z) { this.zoom = z; }
    getZoom() { return this.zoom; }
    setVisible(v) { this.visible = v; }
    setOptions(o) { Object.assign(this.opts, o); }
    addListener(name, fn) { return addListener(this, name, fn); }
  }
  class Map {
    constructor(el, opts) { this.el = el; this.opts = opts; this.center = opts.center; this.zoom = opts.zoom; window.__fakeMaps.push(this); el.innerHTML = '<div data-fake-map style="position:absolute;inset:0;background:#e8eef5;color:#334;font:12px monospace;padding:4px">MAP</div>'; el.style.position = 'relative'; }
    addListener(name, fn) { return addListener(this, name, fn); }
    setCenter(c) { this.center = c; }
    setZoom(z) { this.zoom = z; }
    getZoom() { return this.zoom; }
    fitBounds(b) { this.fitted = b; }
  }
  class Marker { constructor(opts) { this.opts = opts; window.__fakeMarkers.push(this); } setMap(m) { this.opts.map = m; } setPosition(p) { this.opts.position = p; } }
  class Polyline { constructor(opts) { this.opts = opts; window.__fakeLines.push(this); } setMap(m) { this.opts.map = m; } }

  window.__fakePanos = []; window.__fakeMaps = []; window.__fakeMarkers = []; window.__fakeLines = [];
  window.__fakeClick = (lat, lng) => { const map = window.__fakeMaps[window.__fakeMaps.length - 1]; fire(map, 'click', { latLng: new LatLng(lat, lng) }); };
  window.__fakeHeading = (h) => { const p = window.__fakePanos[window.__fakePanos.length - 1]; p.setPov({ heading: h, pitch: 0 }); };

  const libs = {
    core: { LatLng, LatLngBounds, event: { trigger() {} } },
    streetView: { StreetViewPanorama, StreetViewSource: { GOOGLE: 'google', OUTDOOR: 'outdoor' } },
    maps: { Map, Polyline },
    marker: { Marker },
  };
  window.google = window.google || {};
  window.google.maps = Object.assign(window.google.maps || {}, {
    importLibrary: (name) => Promise.resolve(libs[name] || {}),
    SymbolPath: { CIRCLE: 0 },
    Marker,
    event: libs.core.event,
  });
  if (typeof window.__reunitepetsGeoMapsReady === 'function') window.__reunitepetsGeoMapsReady();
})();
