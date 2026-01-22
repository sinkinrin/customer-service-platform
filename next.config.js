const createNextIntlPlugin = require('next-intl/plugin')
const path = require('path')

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // TODO: Add image domains when needed
    ],
  },
  // Skip URL normalization for development/testing
  // This allows LAN access from any IP
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,

  // Performance optimizations
  experimental: {
    // Enable CSS optimization to reduce render-blocking CSS
    optimizeCss: true,
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log/debug in production, but keep info for structured logging
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'info'],
    } : false,
  },

  // Next.js 16: PPR (cacheComponents) 暂不启用
  // 原因：
  // 1. API 路由使用认证（headers()），与 prerendering 不兼容
  // 2. 页面组件访问动态数据，需要包装在 <Suspense> 中
  // 3. 需要更深度的架构重构才能启用
  // 未来启用时取消下面的注释：
  // cacheComponents: true,

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-remove-scroll-bar': path.resolve(__dirname, 'src/lib/shims/react-remove-scroll-bar.tsx'),
    }

    return config
  },
}

module.exports = withNextIntl(nextConfig)

