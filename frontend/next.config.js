/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Build optimizations for memory and speed
  swcMinify: true,
  productionBrowserSourceMaps: false,

  // Ensure static files needed at runtime are copied to standalone output
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./app/lib/uscities.full.json'],
    },
  },

  // Also include in serverComponentsExternalPackages to ensure proper bundling
  serverExternalPackages: [],

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
      ],
    };
  },

  // Redirects
  async redirects() {
    return [
      // Redirect old URLs (if any)
      {
        source: '/report',
        destination: '/missions/new',
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

    // Mark Capacitor packages as external - they're only needed for native app builds
    // This prevents webpack from trying to bundle them in the web build
    const capacitorExternals = [
      '@capacitor/core',
      '@capacitor/app',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
      '@capacitor-community/background-geolocation',
    ];

    config.externals = [
      ...(config.externals || []),
      ...capacitorExternals.map((pkg) => ({
        [pkg]: pkg,
      })),
    ];

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
