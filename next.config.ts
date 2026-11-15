import type { NextConfig } from "next";

// NOTE: Cache Components and other experimental/preview features are intentionally
// NOT enabled in this project (see CLAUDE.md → "Do not change").
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
