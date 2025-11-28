/**
 * Performance Optimization Utilities
 *
 * CDN integration, image optimization, and query helpers.
 */

/**
 * CDN Configuration
 */
const CDN_CONFIG = {
  baseUrl: process.env.CDN_URL || process.env.NEXT_PUBLIC_CDN_URL,
  imageBaseUrl: process.env.CDN_IMAGE_URL || process.env.NEXT_PUBLIC_CDN_URL,
  enabled: !!process.env.CDN_URL || !!process.env.NEXT_PUBLIC_CDN_URL,
};

/**
 * Get CDN URL for a static asset
 */
export function getCdnUrl(path) {
  if (!CDN_CONFIG.enabled || !path) {
    return path;
  }

  // Don't transform external URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${CDN_CONFIG.baseUrl}${normalizedPath}`;
}

/**
 * Get optimized image URL with transformations
 * Supports Cloudflare, Cloudinary, or custom CDN
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url) return '';

  const {
    width,
    height,
    quality = 80,
    format = 'auto',
  } = options;

  // If it's already a CDN URL or we don't have CDN configured, return as-is
  if (!CDN_CONFIG.imageBaseUrl) {
    return url;
  }

  // Handle Cloudinary URLs
  if (url.includes('cloudinary.com')) {
    const transformations = [];
    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    transformations.push(`q_${quality}`);
    if (format !== 'auto') transformations.push(`f_${format}`);

    // Insert transformations into Cloudinary URL
    return url.replace('/upload/', `/upload/${transformations.join(',')}/`);
  }

  // Handle Cloudflare Images
  if (CDN_CONFIG.imageBaseUrl.includes('cloudflare')) {
    const params = [];
    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    params.push(`quality=${quality}`);
    params.push(`format=${format}`);

    const encodedUrl = encodeURIComponent(url);
    return `${CDN_CONFIG.imageBaseUrl}/cdn-cgi/image/${params.join(',')}/${encodedUrl}`;
  }

  // Default: return original URL
  return url;
}

/**
 * Generate responsive image srcSet
 */
export function generateSrcSet(url, widths = [320, 640, 960, 1280, 1920]) {
  if (!url) return '';

  return widths
    .map((w) => `${getOptimizedImageUrl(url, { width: w })} ${w}w`)
    .join(', ');
}

/**
 * Preload critical resources
 */
export function getPreloadLinks(resources) {
  return resources.map((resource) => {
    const { href, as, type, crossOrigin } = resource;
    return {
      rel: 'preload',
      href: getCdnUrl(href),
      as,
      type,
      crossOrigin,
    };
  });
}

/**
 * HTTP Cache Headers Generator
 */
export function getCacheHeaders(options = {}) {
  const {
    maxAge = 300, // 5 minutes default
    staleWhileRevalidate = 60,
    private: isPrivate = false,
    immutable = false,
  } = options;

  const directives = [];

  if (isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  directives.push(`max-age=${maxAge}`);

  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (immutable) {
    directives.push('immutable');
  }

  return {
    'Cache-Control': directives.join(', '),
  };
}

/**
 * Common cache configurations
 */
export const CachePresets = {
  // Static assets - 1 year, immutable
  STATIC: {
    maxAge: 31536000,
    staleWhileRevalidate: 0,
    immutable: true,
  },

  // Public pages - 5 minutes, SWR 1 minute
  PUBLIC_PAGE: {
    maxAge: 300,
    staleWhileRevalidate: 60,
  },

  // Dynamic content - 1 minute, SWR 30 seconds
  DYNAMIC: {
    maxAge: 60,
    staleWhileRevalidate: 30,
  },

  // Private/user-specific - 5 minutes, private
  PRIVATE: {
    maxAge: 300,
    staleWhileRevalidate: 30,
    private: true,
  },

  // No cache
  NO_CACHE: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    private: true,
  },
};

/**
 * Database Query Optimization Helpers
 */

/**
 * Batch queries to reduce database round-trips
 */
export async function batchQueries(queries) {
  const results = await Promise.allSettled(queries);
  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  );
}

/**
 * Parallel query executor with concurrency limit
 */
export async function parallelQueries(queries, maxConcurrency = 5) {
  const results = [];
  const executing = [];

  for (const query of queries) {
    const promise = Promise.resolve().then(() => query());
    results.push(promise);

    if (maxConcurrency <= queries.length) {
      const e = promise.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Pagination helpers
 */
export function getPaginationParams(searchParams, defaults = {}) {
  const { defaultPage = 1, defaultLimit = 20, maxLimit = 100 } = defaults;

  let page = parseInt(searchParams.get('page') || String(defaultPage), 10);
  let limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);

  // Validate
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Create pagination metadata
 */
export function getPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

/**
 * Request deduplication
 * Prevents multiple identical requests from hitting the server
 */
const pendingRequests = new Map();

export async function deduplicateRequest(key, requestFn) {
  // Check if there's already a pending request for this key
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create new request promise
  const promise = requestFn()
    .finally(() => {
      // Clean up after completion
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Debounced request helper (for client-side)
 */
export function createDebouncedFetch(delay = 300) {
  let timeoutId;
  let abortController;

  return async (url, options = {}) => {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Create new abort controller
    abortController = new AbortController();

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(url, {
            ...options,
            signal: abortController.signal,
          });
          resolve(response);
        } catch (error) {
          if (error.name !== 'AbortError') {
            reject(error);
          }
        }
      }, delay);
    });
  };
}

/**
 * Measure execution time
 */
export async function measureTime(label, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`[PERF] ${label} (failed): ${duration.toFixed(2)}ms`);
    throw error;
  }
}

/**
 * Connection pooling hint for Prisma
 */
export function getPrismaConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) return {};

  // Parse connection string to check for pooling
  const isPooled = url.includes('pgbouncer=true') || url.includes('connection_limit');

  return {
    datasources: {
      db: {
        url,
      },
    },
    ...(isPooled ? {} : {
      // Add connection pool settings if not using external pooler
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    }),
  };
}

/**
 * Compression detection
 */
export function supportsCompression(request) {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  return {
    brotli: acceptEncoding.includes('br'),
    gzip: acceptEncoding.includes('gzip'),
    deflate: acceptEncoding.includes('deflate'),
  };
}
