import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Turbopack (default in Next 16)
    turbopack: {
        resolveAlias: {
            fs: { browser: "./lib/empty.ts" },
            path: { browser: "./lib/empty.ts" },
            crypto: { browser: "./lib/empty.ts" },
        },
    },

    // Webpack (used when you pass --webpack, or for some production builds)
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
            };
        }
        return config;
    },
};

export default nextConfig;