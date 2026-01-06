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
        'google-cloud-firestore': false,
        '@google-cloud/firestore': false,
      };
      
      // Set as external to prevent bundling
      config.externals = [
        ...(config.externals || []),
        'firebase-admin',
        'google-gax',
        'google-cloud-firestore',
        '@google-cloud/firestore',
      ];
      
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { module: /firebase-admin/ },
        { module: /google-gax/ },
      ];
    }
    return config;
  },
};

export default nextConfig;
