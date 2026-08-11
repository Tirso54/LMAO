/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    // The game is the deliverable; don't block production builds on lint.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
