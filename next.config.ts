import type { NextConfig } from "next";

// Set STATIC_EXPORT=1 to build a static GitHub Pages bundle.
// Local `npm run dev` and `npm run build` skip this branch so API routes + Prisma keep working.
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export" as const,
        basePath: "/CenturionCRM",
        trailingSlash: true,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
