import type { NextConfig } from "next";
import path from "path";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Proxy REST calls so the browser talks same-origin and the auth cookie is first-party
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
};

export default nextConfig;
