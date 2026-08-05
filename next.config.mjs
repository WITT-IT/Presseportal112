/** @type {import('next').NextConfig} */
const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus.witt-itsolutions.de';
const directusHost = new URL(directusUrl).hostname;
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: directusHost,
        pathname: '/assets/**',
      },
    ],
  },
};
export default nextConfig;
