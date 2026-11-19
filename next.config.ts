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
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "p", value: "(?<page>[2-9]|[1-9]\\d{1,2})" }],
        destination: "/p/:page",
        permanent: false,
      },
      {
        source: "/jobs",
        has: [{ type: "query", key: "state", value: "(?<state>[A-Za-z]{2})" }],
        destination: "/jobs/state/:state",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
