import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      // Polyfill Buffer for browser
      buffer: 'buffer',
    },
  },
};

export default nextConfig;
