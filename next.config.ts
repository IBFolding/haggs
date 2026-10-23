import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production build can go to its own folder (NEXT_DIST_DIR=.next-build) so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // A grabbed frame or a reference picture travels to the server as a data URI.
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default nextConfig;
