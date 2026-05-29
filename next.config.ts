import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/magi": ["./magi-skills/**/*.md"],
    "/api/projects/download": ["./magi-skills/**/*.md"],
  },
};

export default nextConfig;
