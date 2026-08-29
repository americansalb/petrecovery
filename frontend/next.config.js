/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Build optimizations for memory and speed
  swcMinify: true,
  productionBrowserSourceMaps: false,

  // Ensure static files needed at runtime are copied to standalone output
  experimental: {
    // Next 14 does not run instrumentation.js without this flag. Without
    // it the boot assertions in that file - production has somewhere to
    // send exceptions, CAPTCHA is not half-configured, rate limits are
    // durable - are dead code that looks live.
    instrumentationHook: true,

    // Keep the pure-JS render stack (react-pdf) and the resvg native addon out
    // of the webpack server bundle — require()'d from node_modules at runtime.
    serverComponentsExternalPackages: ['@react-pdf/renderer', '@resvg/resvg-js', 'satori', 'yoga-wasm-web'],
    outputFileTracingIncludes: {
      '/*': ['./app/lib/uscities.full.json'],
      // Ensure the vendored flyer/social fonts ship with a standalone build.
      '/api/**': ['./app/lib/cascade/render/fonts/**'],
    },
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Compression
  compress: true,

  // Production optimizations
  poweredByHeader: false,
  generateEtags: true,

  // HTTP Headers for security and caching
  async headers() {
    return [
      {
        // Service workers must always revalidate: a long-cached worker
        // can keep serving a deleted deploy's assets for days
        source: '/:sw(sw|sw-push).js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // Static assets - long cache
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Images - 1 week cache
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // API responses - short cache with revalidation
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            // Allow Apple Maps to render PlaceDetail component
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://*.apple.com https://*.apple-mapkit.com https://maps.apple.com; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },

  // Rewrites for CDN and optimization
  async rewrites() {
    return {
      beforeFiles: [
        // Serve sitemap from API
        {
          source: '/sitemap.xml',
          destination: '/api/sitemap',
        },
        // Serve robots.txt from API
        {
          source: '/robots.txt',
          destination: '/api/robots',
        },
        // Old API paths from before the Rescue Forces rename keep working
        // transparently (rewrites preserve method + body for mobile builds)
        {
          source: '/api/rescue-squads/:path*',
          destination: '/api/rescue-forces/:path*',
        },
        {
          source: '/api/admin/rescue-squads/:path*',
          destination: '/api/admin/rescue-forces/:path*',
        },
      ],
    };
  },

  // Redirects
  async redirects() {
    return [
      // /missions/new never existed; the real wizard lives at /report/new
      {
        source: '/report',
        destination: '/report/new',
        permanent: true,
      },
      // The Sarama story lives on one page now; the old purple standalone
      // promised UI (tip pop-ups, a Mission Command Center) that no longer
      // exists, so the page was folded into /about.
      {
        source: '/about-sarama',
        destination: '/about',
        permanent: true,
      },
      // One add-a-pet wizard: the guest-first Health Book flow at /care/start
      // absorbed the old members-only 9-step wizard.
      {
        source: '/pets/new',
        destination: '/care/start',
        permanent: true,
      },
      // One shelter onboarding flow: the guest-first wizard at
      // /shelter/start absorbed the old members-only request form.
      {
        source: '/shelter/request',
        destination: '/shelter/start',
        permanent: false,
      },
      // /terms duplicated /legal/terms; one canonical page
      {
        source: '/terms',
        destination: '/legal/terms',
        permanent: true,
      },
      // The browse surface is one page now. Exact paths only:
      // /missions/[missionNumber] subroutes keep redirecting into
      // mission control and must not be caught here.
      {
        source: '/missions',
        destination: '/lost-and-found',
        permanent: true,
      },
      {
        source: '/database',
        destination: '/lost-and-found',
        permanent: true,
      },
      // Easy-to-say alias for the Rasuwa flood letter tool, shared by
      // phone and word of mouth
      {
        source: '/nepal',
        destination: '/rasuwa',
        permanent: false,
      },
      // The legacy communities section predates Rescue Forces, which ARE
      // the communities now
      {
        source: '/communities',
        destination: '/rescue-forces/search',
        permanent: true,
      },
      {
        source: '/communities/:path*',
        destination: '/rescue-forces/search',
        permanent: true,
      },
      // "Rescue Squad" is PawBoost's trademark; the brand here is Rescue
      // Forces. Every old link keeps working.
      {
        source: '/rescue-squads',
        destination: '/rescue-forces',
        permanent: true,
      },
      {
        source: '/rescue-squads/:path*',
        destination: '/rescue-forces/:path*',
        permanent: true,
      },
      {
        source: '/admin/rescue-squads/:path*',
        destination: '/admin/rescue-forces/:path*',
        permanent: true,
      },
    ];
  },

  // Webpack optimization
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Keep the cascade render stack out of the webpack bundle on the server so
    // it's require()'d from node_modules at runtime. @resvg/resvg-js ships a
    // native .node addon webpack can't parse; react-pdf/satori/yoga are heavy
    // and pure-JS but don't need bundling. serverComponentsExternalPackages
    // covers RSC but not always route handlers in dev, so pin externals too.
    if (isServer) {
      const externalize = ['@react-pdf/renderer', '@resvg/resvg-js', 'satori', 'yoga-wasm-web'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, cb) =>
          externalize.some((p) => request === p || request.startsWith(`${p}/`))
            ? cb(null, `commonjs ${request}`)
            : cb(),
      ];
    }

    // Memory optimizations for large builds
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      // Reduce memory usage during build
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          default: false,
          vendors: false,
        },
      },
    };

    return config;
  },
};

module.exports = nextConfig;
