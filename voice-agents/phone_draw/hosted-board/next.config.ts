import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/frame", destination: "/api/frame" },
      { source: "/status", destination: "/api/status" },
      { source: "/state", destination: "/api/state" },
    ];
  },
};

export default nextConfig;
