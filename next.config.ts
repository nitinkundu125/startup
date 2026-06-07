import type { NextConfig } from "next";
import os from "os";

function getLocalIps() {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [...getLocalIps()],
};

export default nextConfig;
