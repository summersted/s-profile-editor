import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * IPv4 addresses of this machine on the local network (192.168.x.x etc.).
 * The dev server only serves its dev assets / HMR to localhost by default;
 * listing our own LAN addresses lets other devices open the app via
 * http://<this-pc-ip>:3000 (see `npm run dev:host`).
 */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses(),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
