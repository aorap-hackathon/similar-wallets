/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
    SCROLLSCAN_API_KEY: process.env.SCROLLSCAN_API_KEY,
  }
};

module.exports = nextConfig;
