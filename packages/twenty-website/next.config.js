/** @type {import('next').NextConfig} */

const path = require('path');
const webpack = require('webpack');

const orgchartDist = path.resolve(__dirname, '../twenty-orgchart/dist');

const nextConfig = {
  experimental: {
      serverActions: {
        // Allow Server Actions from our domains when requests are forwarded (e.g. behind proxy/CDN).
        // Bots/crawlers often omit Origin; middleware sets it from Host when missing.
        allowedOrigins: ['arxena.com', 'www.arxena.com', 'localhost:3000'],
      },
    },
  async rewrites() {
    return [
      { source: '/sitemap-index.xml', destination: '/sitemap-index' },
      { source: '/sitemap-:id.xml', destination: '/sitemap/:id' },
    ];
  },
  async redirects() {
    const arxenaSiteUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://services.arxena.com'
        : 'http://localhost:5050';

    return [
      {
        source: '/favicon.ico',
        destination: '/images/favicon/icon-96.png',
        permanent: true,
      },
      {
        source: '/sitemap.xml',
        destination: '/sitemap-index.xml',
        permanent: true,
      },
      // Redirect extension and app download to arxena-site (services.arxena.com in prod, localhost:5050 in dev)
      {
        source: '/extension',
        destination: `${arxenaSiteUrl}/extension`,
        permanent: false,
      },
      {
        source: '/download-app',
        destination: `${arxenaSiteUrl}/download-app`,
        permanent: false,
      },
      {
        source: '/signup',
        destination: 'https://app.arxena.com/sign-up',
        permanent: true,
      },
      {
        source: '/org-chart/meta',
        destination: '/org-chart/facebook',
        permanent: true,
      },
      {
        source: '/org-chart/meta/:path*',
        destination: '/org-chart/facebook/:path*',
        permanent: true,
      },
      {
        source: '/org-chart/samsung/:path*',
        destination: '/org-chart/samsung-electronics/:path*',
        permanent: true,
      },
      // /global/fullcompany is equivalent to base URL - redirect to canonical form
      {
        source: '/org-chart/:companyId/global/fullcompany',
        destination: '/org-chart/:companyId',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'twenty-orgchart': orgchartDist,
      'twenty-orgchart/company-search': path.join(orgchartDist, 'company-search.js'),
    };
    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
