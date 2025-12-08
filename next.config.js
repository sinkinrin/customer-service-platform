const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // TODO: Add image domains when needed
    ],
  },
  // Next.js 16: PPR (cacheComponents) 暂不启用
  // 原因：
  // 1. API 路由使用认证（headers()），与 prerendering 不兼容
  // 2. 页面组件访问动态数据，需要包装在 <Suspense> 中
  // 3. 需要更深度的架构重构才能启用
  // 未来启用时取消下面的注释：
  // cacheComponents: true,
}

module.exports = withNextIntl(nextConfig)

