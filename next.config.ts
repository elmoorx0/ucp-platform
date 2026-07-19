import type { NextConfig } from "next";

/**
 * Next.js configuration — Vercel-compatible.
 *
 * Notes:
 * - `output: "standalone"` is omitted for Vercel (Vercel handles its own build).
 *   Enable it only if you plan to deploy with Docker.
 * - `typescript.ignoreBuildErrors: false` — we want type errors to fail builds.
 * - `reactStrictMode: false` to avoid double-effect execution in dev.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Prisma client binary needs to be included in the serverless bundle
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/.prisma/**/*", "./node_modules/@prisma/client/**/*"],
  },
  // Force these packages to be bundled (not externalized) for serverless
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  experimental: {
    // Optimize package imports for faster builds
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
