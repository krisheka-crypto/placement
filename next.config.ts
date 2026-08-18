import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp needs to run server-side only. Tell webpack to ignore it on the client.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      };
    }
    return config;
  },

  // Silence the Turbopack/webpack conflict warning — we rely on webpack for sharp
  turbopack: {},

  // Bundle sharp on the server side (Next.js 15+ serverExternalPackages)
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
