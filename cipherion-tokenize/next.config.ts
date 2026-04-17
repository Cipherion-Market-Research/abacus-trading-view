import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for containerized deployment (Railway, Docker, AWS)
  // Produces a self-contained build in .next/standalone that doesn't need node_modules
  output: "standalone",
};

export default nextConfig;
