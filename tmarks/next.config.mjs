const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  compress: true,
  images: {
    unoptimized: true,
  },
  typedRoutes: true,
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },
  experimental: {
    optimizePackageImports: [
      '@tanstack/react-query',
      '@tanstack/react-query-persist-client',
      '@tanstack/query-sync-storage-persister',
      'zustand',
    ],
  },
  ...(isDev
    // {
    //   rewrites: async () => [
    //     {
    //       source: '/api/:path*',
    //       destination: 'http://localhost:8787/api/:path*',
    //     },
    //   ],
    // }
    ? {}
    : {}),
};

export default config;
