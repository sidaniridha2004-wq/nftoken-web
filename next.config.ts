import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node-unrar-js ships a .wasm binary and reads it from its own package dir.
  // Keep it un-bundled and make sure the wasm is traced into the serverless
  // function so RAR extraction works on Vercel.
  serverExternalPackages: ["node-unrar-js"],
  outputFileTracingIncludes: {
    "/api/extract": ["./node_modules/node-unrar-js/**/*.wasm"],
  },
};

export default nextConfig;
