import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A grabbed frame or a reference picture travels to the server as a data URI.
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default nextConfig;
