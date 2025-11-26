const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // TODO: Add image domains when needed
    ],
  },
}

module.exports = withNextIntl(nextConfig)

