import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node-unrar-js ships a .wasm binary and reads it from its own package dir.
  // Keep it un-bundled and make sure the wasm and data pool are traced into
  // the serverless function bundle for Vercel and Netlify.
  serverExternalPackages: ["node-unrar-js"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/node-unrar-js/**/*.wasm",
      "./data/**/*.json",
    ],
    "/api/extract": ["./node_modules/node-unrar-js/**/*.wasm"],
    "/api/admin/upload": [
      "./node_modules/node-unrar-js/**/*.wasm",
      "./data/**/*.json",
    ],
    "/api/pool": ["./data/**/*.json"],
    "/api/pool/random": ["./data/**/*.json"],
    "/api/admin/pool": ["./data/**/*.json"],
  },
};

export default nextConfig;
