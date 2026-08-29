/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    // Keep the Neon serverless driver out of the bundler's module graph
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },
};

export default nextConfig;
