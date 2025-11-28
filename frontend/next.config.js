/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Ensure static files needed at runtime are copied to standalone output
  experimental: {
    outputFileTracingIncludes: {
      '/api/*': ['./app/lib/uscities.full.json'],
      '/rescue-squads/*': ['./app/lib/uscities.full.json'],
    },
  },
};

module.exports = nextConfig;
