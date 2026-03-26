import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/pipeline/create": ["./src/fonts/**/*", "./fonts/**/*"],
  },
};

export default nextConfig;
