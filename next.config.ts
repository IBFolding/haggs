import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production build can go to its own folder (NEXT_DIST_DIR=.next-build) so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The render ships its own ffmpeg and ffprobe, so they stay out of the bundle and travel as files.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "sharp"],
  outputFileTracingIncludes: { "/api/render": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"], "/board/[id]/cut": ["./node_modules/ffmpeg-static/ffmpeg"] },
  experimental: {
    // A grabbed frame or a reference picture travels to the server as a data URI.
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default nextConfig;
