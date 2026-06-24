import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://qviowifiqaepwanwdjuj.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://i.pravatar.cc https://ui-avatars.com https://loremflickr.com; connect-src 'self' https://qviowifiqaepwanwdjuj.supabase.co wss://qviowifiqaepwanwdjuj.supabase.co; font-src 'self'; object-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
