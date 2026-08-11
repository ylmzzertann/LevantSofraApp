import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* PGlite ships a WASM build of Postgres and resolves it relative to its own
     files — bundling it breaks that resolution. Only used when DATABASE_URL is
     unset, i.e. local development. */
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
