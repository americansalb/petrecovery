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
            lookup.getPlace(place.id, async (lookupError, fullPlace) => {
              if (lookupError) {
                console.error('[MapKit PlaceLookup] Error:', lookupError);
                resolve(extractPlaceDetails(place));
                return;
              }

              // DEBUG: Log ALL properties on the Place object to find hours
              if (fullPlace) {
                console.log('[MapKit DEBUG] ========== FULL PLACE OBJECT INSPECTION ==========');
                console.log('[MapKit DEBUG] Place name:', fullPlace.name);

                // Get all own properties
                const ownKeys = Object.keys(fullPlace);
                console.log('[MapKit DEBUG] Own keys:', JSON.stringify(ownKeys));

                // Get all properties including prototype chain
                const allProps = [];
                for (let key in fullPlace) {
                  allProps.push(key);
                }
                console.log('[MapKit DEBUG] All enumerable props:', JSON.stringify(allProps));

                // Get property names using Object.getOwnPropertyNames
                try {
                  const propNames = Object.getOwnPropertyNames(fullPlace);
                  console.log('[MapKit DEBUG] getOwnPropertyNames:', JSON.stringify(propNames));
                } catch (e) {}

                // Log each property value
                for (const key of ownKeys) {
                  try {
                    const val = fullPlace[key];
                    const valType = typeof val;
                    if (valType === 'function') {
                      console.log(`[MapKit DEBUG] ${key}: [function]`);
                    } else if (valType === 'object' && val !== null) {
                      console.log(`[MapKit DEBUG] ${key}:`, JSON.stringify(val).substring(0, 200));
                    } else {
                      console.log(`[MapKit DEBUG] ${key}:`, val);
                    }
                  } catch (e) {
                    console.log(`[MapKit DEBUG] ${key}: [error reading]`);
                  }
                }

                // Specifically check for hours-related properties (case insensitive)
                const hoursKeywords = ['hour', 'open', 'close', 'time', 'schedule', 'operation'];
                for (const key of ownKeys) {
                  const lowerKey = key.toLowerCase();
                  for (const keyword of hoursKeywords) {
                    if (lowerKey.includes(keyword)) {
                      console.log(`[MapKit DEBUG] POSSIBLE HOURS FIELD: ${key} =`, fullPlace[key]);
                    }
                  }
                }

                // Check for underscore-prefixed private properties
                for (const key of ownKeys) {
                  if (key.startsWith('_')) {
                    console.log(`[MapKit DEBUG] PRIVATE PROP ${key}:`, fullPlace[key]);
                  }
                }

                // Specifically check known iOS private property names that might exist in JS
                const knownHoursProps = [
                  '_businessHours', 'businessHours', '_messageBusinessHours',
                  '_openingHoursOptions', 'openingHoursOptions',
                  '_hours', 'hours', '_openingHours', 'openingHours',
                  '_hoursOfOperation', 'hoursOfOperation',
                  '_schedule', 'schedule', '_operatingHours', 'operatingHours',
                  '_isOpen', 'isOpen', '_open', 'open',
                  '_openNow', 'openNow', '_currentlyOpen', 'currentlyOpen'
                ];
                console.log('[MapKit DEBUG] Checking known hours properties:');
                for (const prop of knownHoursProps) {
                  try {
                    const val = fullPlace[prop];
                    if (val !== undefined) {
                      console.log(`[MapKit DEBUG] FOUND ${prop}:`, val);
                    }
                  } catch (e) {}
                }

                // Try to access via prototype
                if (fullPlace.__proto__) {
                  const protoKeys = Object.getOwnPropertyNames(fullPlace.__proto__);
                  console.log('[MapKit DEBUG] Prototype keys:', JSON.stringify(protoKeys.slice(0, 50)));
                  for (const prop of knownHoursProps) {
                    if (protoKeys.includes(prop)) {
                      console.log(`[MapKit DEBUG] PROTO ${prop}:`, fullPlace[prop]);
                    }
                  }
                }

                console.log('[MapKit DEBUG] ========== END INSPECTION ==========');
              }

              // Try to get hours by rendering PlaceDetail and extracting from DOM
              let hoursFromCard = null;
              if (mapkit.PlaceDetail && fullPlace) {
                try {
                  hoursFromCard = await extractHoursFromPlaceDetail(mapkit, fullPlace);
                } catch (e) {
                  console.error('[MapKit] Error extracting hours:', e);
                }
              }

              const details = extractPlaceDetails(fullPlace || place);
              if (hoursFromCard) {
                details.hours = hoursFromCard;
              }
              resolve(details);
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
 * Extract hours from PlaceDetail by rendering it and scraping the DOM
 */
async function extractHoursFromPlaceDetail(mapkit, place) {
  return new Promise((resolve) => {
    try {
      // Create a container for PlaceDetail
      const container = document.createElement('div');
      container.id = 'mapkit-place-detail-' + Date.now();
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:400px;height:600px;';
      document.body.appendChild(container);

      // Create PlaceDetail
      const detail = new mapkit.PlaceDetail(container, place, {
        colorScheme: mapkit.PlaceDetail.ColorSchemes.Light,
      });

      console.log('[PlaceDetail] Created for:', place.name);

      // Wait for content to load, then extract hours from DOM
      setTimeout(() => {
        try {
          // Look for hours in the rendered HTML
          const html = container.innerHTML;
          console.log('[PlaceDetail] HTML length:', html.length);

          // Try to find hours text - Apple typically shows it in the card
          // Look for common patterns like "Open until", "Closed", "Hours:", etc.
          let hoursText = null;

          // Check for hours-related elements
          const hoursPatterns = [
            /Open\s+until\s+[\d:]+\s*(?:AM|PM)?/gi,
            /Closed\s*(?:until\s+[\d:]+\s*(?:AM|PM)?)?/gi,
            /Hours?:?\s*[\d:]+\s*(?:AM|PM)?\s*[-–]\s*[\d:]+\s*(?:AM|PM)?/gi,
            /(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi,
          ];

          for (const pattern of hoursPatterns) {
            const match = html.match(pattern);
            if (match) {
              hoursText = match[0];
              console.log('[PlaceDetail] Found hours:', hoursText);
              break;
            }
          }

          // Also try to find any element with hours-related class or aria-label
          const allElements = container.querySelectorAll('*');
          for (const el of allElements) {
            const text = el.textContent?.trim();
            const className = el.className || '';
            const ariaLabel = el.getAttribute('aria-label') || '';

            if (
              className.toLowerCase().includes('hour') ||
              ariaLabel.toLowerCase().includes('hour') ||
              (text && (text.includes('AM') || text.includes('PM')) && text.length < 50)
            ) {
              console.log('[PlaceDetail] Possible hours element:', text);
              if (!hoursText && text) {
                hoursText = text;
              }
            }
          }

          // Cleanup
          document.body.removeChild(container);

          resolve(hoursText);
        } catch (e) {
          console.error('[PlaceDetail] Error parsing:', e);
          document.body.removeChild(container);
          resolve(null);
        }
      }, 2000); // Wait 2 seconds for content to load

    } catch (e) {
      console.error('[PlaceDetail] Creation error:', e);
      resolve(null);
    }
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

  return {
    telephone: place.telephone || null,
    url: websiteUrl,
    hours: null, // Will be populated from PlaceDetail if available
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
