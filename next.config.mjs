/** @type {import('next').NextConfig} */
const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus.witt-itsolutions.de';
const directusHost = new URL(directusUrl).hostname;
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Max Upload-Größe: 3 Fotos à 80 MB + Preview/Download-Varianten
    // = locker 500 MB möglich, 256 MB als sicherer Puffer
    middlewareClientMaxBodySize: 256 * 1024 * 1024,
  },
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
