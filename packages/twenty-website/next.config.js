/** @type {import('next').NextConfig} */

const path = require('path');
const webpack = require('webpack');

const orgchartDist = path.resolve(__dirname, '../twenty-orgchart/dist');

const nextConfig = {
  async redirects() {
    return [
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
