/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Ensure static files needed at runtime are copied to standalone output
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./app/lib/uscities.full.json'],
    },
  },
  // Also include in serverComponentsExternalPackages to ensure proper bundling
  serverExternalPackages: [],
};

module.exports = nextConfig;
