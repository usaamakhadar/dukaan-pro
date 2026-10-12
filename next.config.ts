import type { NextConfig } from "next";

let supabaseHttp = "https://*.supabase.co";
let supabaseWs = "wss://*.supabase.co";

try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const parsed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supabaseHttp = parsed.origin;
    supabaseWs = `wss://${parsed.host}`;
  }
} catch {
  // Fallback to pattern matching
}

const cspHeader = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ${supabaseHttp}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; connect-src 'self' ${supabaseHttp} ${supabaseWs}; font-src 'self'; object-src 'none'; frame-ancestors 'none';`;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
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
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
