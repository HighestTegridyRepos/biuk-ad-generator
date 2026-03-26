import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/pipeline/create": ["./src/fonts/**/*", "./fonts/**/*"],
  },
};

export default nextConfig;
