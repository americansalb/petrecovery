/**
 * Apple MapKit JS Integration
 *
 * Provides utilities for initializing and working with Apple Maps.
 * Uses MapKit JS v5.x with JWT authentication.
 *
 * Documentation: https://developer.apple.com/documentation/mapkitjs
 */

// MapKit JS CDN URL
const MAPKIT_JS_URL = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

// Token - In production, this should come from an environment variable
// or be fetched from a secure backend endpoint
const MAPKIT_TOKEN = process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN ||
  'eyJraWQiOiJWM0xWNVNMNEJBIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJCRjIzTjRINjdWIiwiaWF0IjoxNzY1MzEyNDI3LCJvcmlnaW4iOiJwZXRyZWNvdmVyeS5vbnJlbmRlci5jb20ifQ.UTZplSiKmf2hhBbGtCpaQ-50F2tRuCbrpSXuorelsS9wxvp--hl3n5qFMgL_RHxOcigAPWfRVA0hkazq2uuaFA';

// Track initialization state
let mapkitInitialized = false;
let mapkitLoading = false;
let initPromise = null;

/**
 * Load MapKit JS script dynamically
 */
function loadMapKitScript() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.mapkit) {
      resolve(window.mapkit);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src="${MAPKIT_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.mapkit));
      existingScript.addEventListener('error', reject);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = MAPKIT_JS_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;

    script.onload = () => {
      if (window.mapkit) {
        resolve(window.mapkit);
      } else {
        reject(new Error('MapKit JS loaded but mapkit object not found'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load MapKit JS'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Initialize MapKit with JWT token
 * Returns a promise that resolves when MapKit is ready
 */
export async function initializeMapKit() {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  // Return immediately if already initialized
  if (mapkitInitialized && window.mapkit) {
    return window.mapkit;
  }

  initPromise = (async () => {
    try {
      mapkitLoading = true;

      // Load the script
      const mapkit = await loadMapKitScript();

      // Initialize with token
      mapkit.init({
        authorizationCallback: (done) => {
          done(MAPKIT_TOKEN);
        },
        language: 'en',
      });

      mapkitInitialized = true;
      mapkitLoading = false;

      console.log('[AppleMapKit] Initialized successfully');
      return mapkit;
    } catch (error) {
      mapkitLoading = false;
      initPromise = null;
      console.error('[AppleMapKit] Initialization failed:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if MapKit is initialized
 */
export function isMapKitInitialized() {
  return mapkitInitialized && window.mapkit;
}

/**
 * Check if MapKit is currently loading
 */
export function isMapKitLoading() {
  return mapkitLoading;
}

/**
 * Get MapKit instance (throws if not initialized)
 */
export function getMapKit() {
  if (!mapkitInitialized || !window.mapkit) {
    throw new Error('MapKit not initialized. Call initializeMapKit() first.');
  }
  return window.mapkit;
}

/**
 * Create a coordinate from lat/lng
 */
export function createCoordinate(latitude, longitude) {
  const mapkit = getMapKit();
  return new mapkit.Coordinate(latitude, longitude);
}

/**
 * Create a coordinate region (for setting map bounds)
 */
export function createCoordinateRegion(centerLat, centerLng, latSpan = 0.05, lngSpan = 0.05) {
  const mapkit = getMapKit();
  return new mapkit.CoordinateRegion(
    new mapkit.Coordinate(centerLat, centerLng),
    new mapkit.CoordinateSpan(latSpan, lngSpan)
  );
}

/**
 * Create a marker annotation
 */
export function createMarkerAnnotation(latitude, longitude, options = {}) {
  const mapkit = getMapKit();
  const coordinate = new mapkit.Coordinate(latitude, longitude);

  const annotation = new mapkit.MarkerAnnotation(coordinate, {
    color: options.color || '#FF3B30',
    title: options.title || '',
    subtitle: options.subtitle || '',
    glyphText: options.glyphText || '',
    glyphColor: options.glyphColor || '#FFFFFF',
    selected: options.selected || false,
    draggable: options.draggable || false,
    callout: options.callout,
    data: options.data || {},
  });

  return annotation;
}

/**
 * Create a custom image annotation
 */
export function createImageAnnotation(latitude, longitude, options = {}) {
  const mapkit = getMapKit();
  const coordinate = new mapkit.Coordinate(latitude, longitude);

  const annotation = new mapkit.ImageAnnotation(coordinate, {
    url: options.url ? { 1: options.url } : undefined,
    title: options.title || '',
    subtitle: options.subtitle || '',
    anchorOffset: options.anchorOffset || new DOMPoint(0, 0),
    size: options.size || { width: 40, height: 40 },
    data: options.data || {},
  });

  return annotation;
}

/**
 * Create a circle overlay
 */
export function createCircleOverlay(centerLat, centerLng, radiusMeters, options = {}) {
  const mapkit = getMapKit();
  const coordinate = new mapkit.Coordinate(centerLat, centerLng);

  return new mapkit.CircleOverlay(coordinate, radiusMeters, {
    style: new mapkit.Style({
      strokeColor: options.strokeColor || '#007AFF',
      strokeOpacity: options.strokeOpacity || 0.8,
      lineWidth: options.lineWidth || 2,
      fillColor: options.fillColor || '#007AFF',
      fillOpacity: options.fillOpacity || 0.2,
    }),
  });
}

/**
 * Create a polyline overlay (for GPS paths)
 */
export function createPolylineOverlay(coordinates, options = {}) {
  const mapkit = getMapKit();

  const points = coordinates.map(coord =>
    new mapkit.Coordinate(coord.lat || coord.latitude, coord.lng || coord.longitude)
  );

  return new mapkit.PolylineOverlay(points, {
    style: new mapkit.Style({
      strokeColor: options.strokeColor || '#34C759',
      strokeOpacity: options.strokeOpacity || 0.9,
      lineWidth: options.lineWidth || 4,
      lineCap: options.lineCap || 'round',
      lineJoin: options.lineJoin || 'round',
    }),
  });
}

/**
 * Create a polygon overlay (for search areas)
 */
export function createPolygonOverlay(coordinates, options = {}) {
  const mapkit = getMapKit();

  const points = coordinates.map(coord =>
    new mapkit.Coordinate(coord.lat || coord.latitude, coord.lng || coord.longitude)
  );

  return new mapkit.PolygonOverlay(points, {
    style: new mapkit.Style({
      strokeColor: options.strokeColor || '#007AFF',
      strokeOpacity: options.strokeOpacity || 0.8,
      lineWidth: options.lineWidth || 2,
      fillColor: options.fillColor || '#007AFF',
      fillOpacity: options.fillOpacity || 0.3,
    }),
  });
}

/**
 * Map type constants
 */
export const MapTypes = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  MUTED_STANDARD: 'mutedStandard',
};

/**
 * Color palette for map elements
 */
export const MapColors = {
  // Status colors
  URGENT: '#FF3B30',      // Red - urgent/critical
  ACTIVE: '#FF9500',      // Orange - active
  EXTENDED: '#FFCC00',    // Yellow - extended search
  SUCCESS: '#34C759',     // Green - reunited/success
  INFO: '#007AFF',        // Blue - info/default

  // Feature colors
  LAST_SEEN: '#FF3B30',   // Red marker for last seen
  SIGHTING: '#FF9500',    // Orange for sightings
  SEARCH_PATH: '#34C759', // Green for GPS path
  USER_LOCATION: '#007AFF', // Blue for user
  SEARCH_AREA: '#5856D6', // Purple for search zones
  COLD_SPOT: '#FF3B30',   // Red for flyer cold spots

  // Probability zones
  HIGH_PROB: '#FF3B30',
  MEDIUM_PROB: '#FF9500',
  LOW_PROB: '#FFCC00',
};

/**
 * Default map options
 */
export const DefaultMapOptions = {
  center: { lat: 39.8283, lng: -98.5795 }, // US center
  zoom: 12,
  showsCompass: 'adaptive',
  showsScale: 'adaptive',
  showsUserLocation: true,
  showsUserLocationControl: true,
  tracksUserLocation: false,
  mapType: MapTypes.STANDARD,
  colorScheme: 'dark', // 'light' | 'dark'
  padding: { top: 20, right: 20, bottom: 20, left: 20 },
};

/**
 * Search for a place by name and location to get full details including phone/hours
 * Uses two-step process: Search to find place, then PlaceLookup to get rich details
 */
export async function searchPlaceDetails(name, latitude, longitude) {
  const mapkit = await initializeMapKit();

  return new Promise((resolve, reject) => {
    const search = new mapkit.Search({
      region: new mapkit.CoordinateRegion(
        new mapkit.Coordinate(latitude, longitude),
        new mapkit.CoordinateSpan(0.1, 0.1)
      ),
      includePointsOfInterest: true,
    });

    search.search(name, async (error, data) => {
      if (error) {
        console.error('[MapKit Search] Error:', error);
        resolve(null);
        return;
      }

      if (data?.places?.length > 0) {
        const place = data.places[0];

        // If place has an ID, use PlaceLookup to get full details
        if (place.id && mapkit.PlaceLookup) {
          try {
            const lookup = new mapkit.PlaceLookup();
            lookup.getPlace(place.id, (lookupError, fullPlace) => {
              if (lookupError) {
                console.error('[MapKit PlaceLookup] Error:', lookupError);
                resolve(extractPlaceDetails(place));
                return;
              }

              resolve(extractPlaceDetails(fullPlace || place));
            });
          } catch (err) {
            console.error('[MapKit PlaceLookup] Exception:', err);
            resolve(extractPlaceDetails(place));
          }
        } else {
          // No PlaceLookup available, use search result directly
          resolve(extractPlaceDetails(place));
        }
      } else {
        console.log('[MapKit Search] No places found for:', name);
        resolve(null);
      }
    });
  });
}

/**
 * Extract contact details from a place object
 */
function extractPlaceDetails(place) {
  if (!place) return null;

  // Get URL from urls array (MapKit JS uses plural 'urls')
  let websiteUrl = null;
  if (place.urls && Array.isArray(place.urls) && place.urls.length > 0) {
    websiteUrl = place.urls[0];
  } else if (place.url) {
    websiteUrl = place.url;
  }

  // Note: MapKit JS does not provide hours/openingHours data
  // Hours are only available through the PlaceDetail UI component

  return {
    telephone: place.telephone || null,
    url: websiteUrl,
    hours: null, // Not available in MapKit JS PlaceLookup API
  };
}

/**
 * Enrich an array of shelters with phone/hours from MapKit JS client-side
 */
export async function enrichSheltersWithDetails(shelters, maxToEnrich = 10) {
  const mapkit = await initializeMapKit();

  const enriched = await Promise.all(
    shelters.slice(0, maxToEnrich).map(async (shelter) => {
      // Skip if already has phone
      if (shelter.phone) {
        return shelter;
      }

      try {
        const details = await searchPlaceDetails(
          shelter.name,
          shelter.latitude || shelter.lat,
          shelter.longitude || shelter.lng
        );

        if (details) {
          return {
            ...shelter,
            phone: details.telephone || shelter.phone,
            website: details.url || shelter.website,
            hours: details.hours || shelter.hours,
          };
        }
      } catch (err) {
        console.error('[MapKit Enrich] Error for', shelter.name, err);
      }

      return shelter;
    })
  );

  // Return enriched shelters plus any remaining (not enriched)
  return [...enriched, ...shelters.slice(maxToEnrich)];
}

export default {
  initializeMapKit,
  isMapKitInitialized,
  isMapKitLoading,
  getMapKit,
  createCoordinate,
  createCoordinateRegion,
  createMarkerAnnotation,
  createImageAnnotation,
  createCircleOverlay,
  createPolylineOverlay,
  createPolygonOverlay,
  searchPlaceDetails,
  enrichSheltersWithDetails,
  MapTypes,
  MapColors,
  DefaultMapOptions,
};
