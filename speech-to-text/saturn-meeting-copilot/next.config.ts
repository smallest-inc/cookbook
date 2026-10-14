import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        // Allow the Chrome extension side panel to embed Saturn in an iframe
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      {
        // Allow the Chrome extension (meet.google.com origin) to POST segments
        source: "/api/transcript/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
