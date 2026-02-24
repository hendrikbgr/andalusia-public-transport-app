const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Never cache API calls — always network
        urlPattern: /^https:\/\/api\.ctan\.es\//,
        handler: 'NetworkOnly',
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence the "webpack config but no turbopack config" warning.
  // next-pwa injects webpack config internally; the app itself has no
  // custom webpack config, so Turbopack works fine for dev.
  turbopack: {},

  // Redirect old .html URLs so existing bookmarks still work
  async redirects() {
    return [
      { source: '/index.html',        destination: '/',              permanent: true },
      { source: '/stops.html',        destination: '/stops',         permanent: true },
      { source: '/station.html',      destination: '/station',       permanent: true },
      { source: '/route.html',        destination: '/route',         permanent: true },
      { source: '/map.html',          destination: '/map',           permanent: true },
      { source: '/planner.html',      destination: '/planner',       permanent: true },
      { source: '/journey.html',      destination: '/journey',       permanent: true },
      { source: '/timetable.html',    destination: '/timetable',     permanent: true },
      { source: '/linetimetable.html',destination: '/linetimetable', permanent: true },
      { source: '/settings.html',     destination: '/settings',      permanent: true },
    ];
  },
};

module.exports = withPWA(nextConfig);
