import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "smallest.ai" },
      { protocol: "https", hostname: "app.smallest.ai" },
    ],
  },
};

export default nextConfig;
