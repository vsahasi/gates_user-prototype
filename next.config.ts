import type { NextConfig } from "next";

// Files read from disk at request time (not imported) must be traced into the
// serverless bundle explicitly. Both key forms so single- and multi-segment
// routes all match.
const runtimeFiles = ["db/migrations/**/*", "data/pathwayai.demo.db"];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": runtimeFiles,
    "/**": runtimeFiles,
  },
};

export default nextConfig;
