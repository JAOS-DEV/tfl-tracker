import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iBus JSON is served as static CDN assets under /data/ibus/*. After-midnight
  // replay reads the same tree via fs for local/dev, which makes NFT pull the
  // whole multi-version pack into every API function (~150MB+ each). Keep it
  // out of serverless bundles; browser clients still fetch it from public/.
  outputFileTracingExcludes: {
    "/*": ["./public/data/ibus/**/*"],
  },
  async headers() {
    return [
      {
        source: "/data/ibus/:baseVersion((?!current\\.json$)[^/]+)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
