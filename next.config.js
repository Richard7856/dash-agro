/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default

module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
})(
  { reactStrictMode: true }
)
