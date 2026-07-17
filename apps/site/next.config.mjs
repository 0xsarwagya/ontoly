import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ["ts", "tsx", "mdx"],
  async redirects() {
    return [
      { source: "/github", destination: "https://github.com/0xsarwagya/ontoly", permanent: false },
      { source: "/npm", destination: "https://www.npmjs.com/package/@0xsarwagya/ontoly-cli", permanent: false },
      { source: "/docs", destination: "/docs/getting-started/introduction", permanent: false },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
