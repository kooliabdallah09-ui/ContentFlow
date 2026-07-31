import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/refund', destination: '/refunds', permanent: true },
    ]
  },
};

export default nextConfig;
