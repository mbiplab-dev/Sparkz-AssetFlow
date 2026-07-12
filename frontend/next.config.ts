import type { NextConfig } from "next";

/**
 * Proxy /api/* → Django backend.
 *
 * Required when NEXT_PUBLIC_API_URL is empty (same-origin mode used for
 * Cloudflare tunnels and when the browser must not call localhost:8000).
 * Django routes require trailing slashes — keep skipTrailingSlashRedirect.
 */
const backendOrigin =
  process.env.BACKEND_ORIGIN?.replace(/\/$/, "") || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      {
        source: "/signin",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/register",
        destination: "/signup",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*/",
        destination: `${backendOrigin}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
