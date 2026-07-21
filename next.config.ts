import type { NextConfig } from "next";

/**
 * Next.js configuration — Vercel-compatible.
 *
 * Notes:
 * - `output: "standalone"` is omitted for Vercel (Vercel handles its own build).
 *   Enable it only if you plan to deploy with Docker.
 * - `reactStrictMode: false` to avoid double-effect execution in dev.
 * - Next.js 16 no longer supports `typescript.ignoreBuildErrors` or `eslint.ignoreDuringBuilds`
 *   in the config — type errors and lint errors will fail the build by default.
 */
const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Prisma client binary needs to be included in the serverless bundle
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@libsql/**/*",
      "./node_modules/libsql/**/*",
    ],
  },
  // Externalize these packages so they're loaded at runtime from node_modules
  // instead of being bundled by Turbopack (avoids resolution errors)
  serverExternalPackages: [
    "@prisma/client",
    "@node-rs/argon2",
    "@libsql/client",
    "@prisma/adapter-libsql",
    "libsql",
  ],
  experimental: {
    // Optimize package imports for faster builds
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
