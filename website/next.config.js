/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Netlify. 'next dev' can't run the [lang] routes in export mode,
  // so run it as: NEXT_NO_EXPORT=1 npm run dev
  output: process.env.NEXT_NO_EXPORT ? undefined : 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};
module.exports = nextConfig;
