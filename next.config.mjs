/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'firebase-admin': false,
        'google-gax': false,
      };
      config.externals = [
        ...(config.externals || []),
        {
          'firebase-admin': 'firebase-admin',
          'google-gax': 'google-gax',
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
