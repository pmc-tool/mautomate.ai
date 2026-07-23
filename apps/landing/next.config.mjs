import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to THIS app. The surrounding monorepo has its own
  // lockfile, which otherwise makes Next infer the wrong root and mis-resolve
  // the app (breaking output:export page collection).
  turbopack: { root: __dirname },
  reactStrictMode: true,
  // Static export so the landing can be served by nginx from a plain build dir
  // (mautomate.ai -> nginx :8100 -> /home/ratul/mautomate/build), matching how
  // the current landing is served. No Node server needed.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
