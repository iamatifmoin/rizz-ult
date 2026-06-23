import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg", "sharp"],
  outputFileTracingIncludes: {
    "/api/generate-video": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./public/fonts/caption.ttf",
      "./public/audio/**",
    ],
  },
};

export default nextConfig;
