import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Anexos dos cursos são enviados por server action (limite em src/lib/files.ts)
    serverActions: { bodySizeLimit: "52mb" },
  },
};

export default nextConfig;
