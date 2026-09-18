const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const longitude = (value) => ((value + 180) % 360 + 360) % 360 - 180;

export function appleKeyboard(mapRef, mapkit, onPin) {
  return {
    pan(x, y) {
      const map = mapRef.current;
      if (!map?.region || !mapkit) return;
      const { center, span } = map.region;
      map.region = new mapkit.CoordinateRegion(new mapkit.Coordinate(
        clamp(center.latitude - y * span.latitudeDelta / 6, -85, 85),
        longitude(center.longitude + x * span.longitudeDelta / 6),
      ), span);
    },
    zoom(direction) {
      const map = mapRef.current;
      if (!map?.region || !mapkit) return;
      const { center, span } = map.region;
      const factor = direction > 0 ? 0.5 : 2;
      map.region = new mapkit.CoordinateRegion(center, new mapkit.CoordinateSpan(
        clamp(span.latitudeDelta * factor, 0.01, 150),
        clamp(span.longitudeDelta * factor, 0.01, 360),
      ));
    },
    place() {
      const center = mapRef.current?.region?.center;
      if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return null;
      const point = { lat: clamp(center.latitude, -85, 85), lng: longitude(center.longitude) };
      onPin?.(point);
      return point;
    },
  };
}

export function ignoreGameShortcut(event) {
  return event.defaultPrevented || Boolean(event.target?.closest?.(
    'input, textarea, select, button, a, [contenteditable="true"], [role="tab"], [role="dialog"], dialog, [data-keyboard-map]'
  ));
}
