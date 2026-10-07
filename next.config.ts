import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The jobs form posts the resume with the application so the email can
      // attach it. Files are capped at 4 MB. 5mb leaves room for the other
      // fields and stays under Vercel's 4.5 MB request-body limit.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
