# 基础设施：Next.js 框架

## ADDED Requirements

### Requirement: Next.js 安全补丁
系统 SHALL 使用已修复已知安全漏洞的 Next.js 版本（14.2.25+）。

#### Scenario: Middleware 认证保护
- **GIVEN** 系统使用 Next.js 14.2.25 或更高版本
- **WHEN** 攻击者尝试通过 `x-middleware-subrequest` header 绕过 middleware
- **THEN** 请求 SHALL 被正常处理，middleware 认证检查不被绕过

### Requirement: 客户端路由缓存配置
系统 SHALL 支持配置客户端路由缓存失效时间以优化页面切换性能。

#### Scenario: staleTimes 配置生效
- **GIVEN** `next.config.js` 配置了 `experimental.staleTimes`
- **WHEN** 用户在缓存有效期内切换到已访问的页面
- **THEN** 页面 SHALL 从客户端缓存加载，无需重新请求服务器

### Requirement: Turbopack 开发模式支持
系统 SHALL 支持可选的 Turbopack 开发模式以加快本地开发体验。

#### Scenario: Turbopack 开发服务器启动
- **GIVEN** 开发者运行 `npm run dev:turbo`
- **WHEN** Turbopack 开发服务器启动
- **THEN** 系统 SHALL 比默认 webpack 模式更快完成初始编译

### Requirement: Partial Prerendering 增量测试
系统 SHALL 支持在选定页面启用 PPR（Partial Prerendering）以提升首屏加载速度。

#### Scenario: PPR 页面静态 shell 预渲染
- **GIVEN** 页面导出 `experimental_ppr = true`
- **AND** `next.config.js` 配置 `experimental.ppr = 'incremental'`
- **WHEN** 执行 `npm run build`
- **THEN** 系统 SHALL 将页面的静态部分预渲染为 HTML shell

#### Scenario: PPR 页面动态内容流式传输
- **GIVEN** PPR 页面包含 `<Suspense>` 包裹的动态组件
- **WHEN** 用户请求该页面
- **THEN** 系统 SHALL 立即返回静态 shell
- **AND** 动态内容 SHALL 通过流式传输逐步填充

#### Scenario: PPR 动态边界错误检测
- **GIVEN** PPR 页面中动态数据访问未被 `<Suspense>` 包裹
- **WHEN** 执行 `npm run build`
- **THEN** 系统 SHALL 抛出构建错误提示 "Uncached data was accessed outside of Suspense"

### Requirement: PPR 测试页面选择
系统 SHALL 在以下页面启用 PPR 进行增量测试：

#### Scenario: 首页 PPR 启用
- **GIVEN** 首页 `/` 启用 PPR
- **WHEN** 用户访问首页
- **THEN** 导航栏和静态内容 SHALL 立即显示
- **AND** 用户相关的动态内容 SHALL 通过 Suspense 流式加载

#### Scenario: FAQ 列表页 PPR 启用
- **GIVEN** FAQ 列表页 `/customer/faq` 启用 PPR
- **WHEN** 用户访问 FAQ 页面
- **THEN** 页面布局和分类列表 SHALL 立即显示
- **AND** 搜索结果等动态内容 SHALL 通过 Suspense 流式加载

#### Scenario: Customer Dashboard PPR 启用
- **GIVEN** Dashboard `/customer/dashboard` 启用 PPR
- **WHEN** 用户访问 Dashboard
- **THEN** 页面布局和静态组件 SHALL 立即显示
- **AND** 统计数据和动态卡片 SHALL 通过 Suspense 流式加载
