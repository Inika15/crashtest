/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crashtest/runner', '@crashtest/scoring'],
};

export default nextConfig;
