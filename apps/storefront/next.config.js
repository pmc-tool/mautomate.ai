const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * CMS media hosts (phase-0-architecture.md §7.3). Optional — set in prod when
 * media is served from a CDN (CloudFront) or an S3-compatible host (R2 / Spaces
 * / MinIO). The dev file-local host (http://localhost:9000/static/...) is
 * already covered by the localhost remotePattern below.
 */
const MEDIA_CDN_HOST = process.env.NEXT_PUBLIC_MEDIA_CDN_HOST
const MEDIA_S3_HOST = process.env.NEXT_PUBLIC_MEDIA_S3_HOST

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async rewrites() {
    // Proxy the analytics tracker + collector through the storefront so Umami
    // stays internal-only and same-origin (no CORS, better privacy/CSP).
    const umami = process.env.UMAMI_PROXY_TARGET || "http://127.0.0.1:8770"
    return [{ source: "/umami/:path*", destination: `${umami}/:path*` }]
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
      ...(MEDIA_CDN_HOST
        ? [{ protocol: "https", hostname: MEDIA_CDN_HOST }]
        : []),
      ...(MEDIA_S3_HOST
        ? [{ protocol: "https", hostname: MEDIA_S3_HOST }]
        : []),
    ],
  },
}

module.exports = nextConfig
