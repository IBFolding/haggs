import type { NextConfig } from "next";

/** Headers every response carries. The page may run its own scripts and styles and load media from this site and its file store. */
const SECURITY = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY }];
  },
  // A production build can go to its own folder (NEXT_DIST_DIR=.next-build) so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The render ships its own ffmpeg and ffprobe, so they stay out of the bundle and travel as files.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "sharp"],
  outputFileTracingIncludes: { "/api/grey/render": ["./node_modules/ffmpeg-static/ffmpeg"], "/api/render": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"], "/board/[id]/cut": ["./node_modules/ffmpeg-static/ffmpeg"] },
  experimental: {
    // A grabbed frame or a reference picture travels to the server as a data URI.
    serverActions: { bodySizeLimit: "24mb" },
  },
};

export default nextConfig;
