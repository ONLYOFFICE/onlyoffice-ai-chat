import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@onlyoffice/ai-chat"],
};

export default nextConfig;
