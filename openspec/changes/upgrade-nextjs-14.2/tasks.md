# 任务清单：Next.js 14.2 升级

## 1. 依赖升级
- [x] 1.1 升级 `next` 至 `14.2.25`
- [x] 1.2 升级 `eslint-config-next` 至 `14.2.25` (已是 14.2.33)
- [x] 1.3 运行 `npm install` 更新 lock 文件
- [x] 1.4 删除 `node_modules` 和 `.next` 后重新安装（确保干净状态）✅

## 2. 配置更新
- [x] 2.1 在 `next.config.js` 添加 `experimental.staleTimes` 配置
- [x] 2.2 在 `next.config.js` 添加 `experimental.ppr = 'incremental'` 配置 (已注释，需要 canary 版本)
- [x] 2.3 在 `package.json` 添加 `dev:turbo` 脚本（可选）

## 3. PPR 页面改造
- [ ] 3.1 首页 `/` (src/app/page.tsx)
  - [ ] 3.1.1 添加 `export const experimental_ppr = true`
  - [ ] 3.1.2 识别动态内容（用户信息、登录状态）
  - [ ] 3.1.3 用 `<Suspense>` 包裹动态组件
  - [ ] 3.1.4 创建对应的 loading fallback 组件
- [ ] 3.2 FAQ 列表页 `/customer/faq` (src/app/customer/faq/page.tsx)
  - [ ] 3.2.1 添加 `export const experimental_ppr = true`
  - [ ] 3.2.2 识别动态内容（搜索结果、用户偏好）
  - [ ] 3.2.3 用 `<Suspense>` 包裹动态组件
  - [ ] 3.2.4 创建对应的 loading fallback 组件
- [x] 3.3 Customer Dashboard `/customer/dashboard` (src/app/customer/dashboard/page.tsx)
  - [x] 3.3.1 添加 `export const experimental_ppr = true` (已注释，需要 canary 版本)
  - [x] 3.3.2 重构为 Server Component + Client Component 分离
  - [x] 3.3.3 翻译在服务端完成，传递给客户端组件
  - [ ] 3.3.4 创建对应的 loading fallback 组件 - 可选

## 4. 验证测试
- [x] 4.1 运行 `npm run build` 确认构建成功
- [x] 4.2 运行 `npm run dev` 确认开发服务器正常
- [x] 4.3 测试 Middleware 认证保护
  - [x] 4.3.1 未登录访问 `/admin` 应重定向到登录页 ✅
  - [x] 4.3.2 未登录访问 `/staff` 应重定向到登录页 ✅
  - [x] 4.3.3 未登录访问 `/customer` 应重定向到登录页 ✅
  - [x] 4.3.4 普通用户访问 `/admin` 应显示未授权页面 ✅
- [x] 4.4 检查页面样式是否正常 ✅
- [x] 4.5 检查字体加载是否正常 ✅
- [x] 4.6 测试页面切换是否流畅 ✅
- [~] 4.7 验证 PPR 页面 (跳过 - PPR 需要 canary 版本)
  - [~] 4.7.1 首页静态 shell 立即显示
  - [~] 4.7.2 FAQ 页面布局立即显示
  - [~] 4.7.3 Dashboard 布局立即显示
  - [~] 4.7.4 动态内容通过流式传输加载

## 5. 可选优化
- [ ] 5.1 测试 `npm run dev:turbo` 开发体验
- [ ] 5.2 记录构建时间和内存占用基准数据

## 6. 文档更新
- [x] 6.1 更新 CHANGELOG.md 记录升级 ✅
