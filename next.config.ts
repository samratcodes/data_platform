import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows verification builds to run beside an active development server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
