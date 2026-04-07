import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  
  // ═══ High-Octane Engine: Performance Optimizations ═══
  
  // Note: cacheComponents (PPR) temporarily disabled to allow dynamic routes
  // Will re-enable after adding proper Suspense boundaries
  // cacheComponents: true,
  
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
  
  // Turbopack configuration (Next.js 16 default bundler)
  turbopack: {
    // Empty config to silence webpack warning
  },
  
  // External packages that should not be bundled (server only)
  serverExternalPackages: [
    'sharp',
    'onnxruntime-node',
  ],
  
  // Packages that need transpilation
  transpilePackages: [
    'mathml2omml',
    'pptxgenjs',
  ],
  
  // Image optimization - force modern formats
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
