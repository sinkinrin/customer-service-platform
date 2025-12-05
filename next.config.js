const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // TODO: Add image domains when needed
    ],
  },
  experimental: {
    // 客户端路由缓存配置
    staleTimes: {
      dynamic: 30,  // 动态路由缓存 30 秒
      static: 180,  // 静态路由缓存 3 分钟
    },
    // PPR 需要 canary 版本，暂不启用
    // ppr: 'incremental',
  },
}

module.exports = withNextIntl(nextConfig)

