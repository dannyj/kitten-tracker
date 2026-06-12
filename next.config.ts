import type { NextConfig } from "next";

// CSP is set per-request in src/proxy.ts (nonce-based). Everything static
// lives here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Enable HSTS once the NPM certificate setup has been stable for a while.
  // Start with a short max-age and raise it; this header is hard to undo.
  // { key: "Strict-Transport-Security", value: "max-age=86400" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
