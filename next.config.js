/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  devIndicators: {
    appIsrStatus: false,
  }
};

module.exports = nextConfig;
