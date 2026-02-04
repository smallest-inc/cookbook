import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix for monorepo/nested package structure
  // Tells turbopack to use this directory as root, not parent
  experimental: {
    turbo: {
      root: ".",
    },
  },
};

export default nextConfig;
