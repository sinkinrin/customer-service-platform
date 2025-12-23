# 实施任务清单

## 1. 测试基础设施配置

### 1.1 安装依赖
- [x] 1.1.1 安装 Vitest 及相关包
  ```bash
  npm install -D vitest @vitest/coverage-v8 @vitest/ui
  ```
- [x] 1.1.2 安装 React Testing Library
  ```bash
  npm install -D @testing-library/react @testing-library/jest-dom happy-dom
  ```
- [x] 1.1.3 安装 Playwright
  ```bash
  npm install -D @playwright/test
  npx playwright install
  ```
- [x] 1.1.4 安装 MSW (Mock Service Worker)
  ```bash
  npm install -D msw
  ```

### 1.2 配置文件
- [x] 1.2.1 创建 `vitest.config.ts`
- [x] 1.2.2 创建 `playwright.config.ts`
- [x] 1.2.3 创建 `__tests__/setup.ts` 测试初始化
- [ ] 1.2.4 更新 `tsconfig.json` 添加测试类型
- [x] 1.2.5 更新 `package.json` 添加测试脚本

### 1.3 目录结构
- [x] 1.3.1 创建 `__tests__/unit/` 目录
- [x] 1.3.2 创建 `__tests__/api/` 目录
- [x] 1.3.3 创建 `e2e/` 目录（Playwright 测试）
- [x] 1.3.4 创建 `__tests__/fixtures/` 目录
- [x] 1.3.5 创建 `__tests__/mocks/` 目录

---

## 2. Mock 基础设施

### 2.1 MSW 配置
- [x] 2.1.1 创建 `__tests__/mocks/handlers.ts` - API Mock 处理器
- [x] 2.1.2 创建 `__tests__/mocks/server.ts` - MSW 服务器配置
- [x] 2.1.3 创建 `__tests__/mocks/zammad.ts` - Zammad API Mock（已包含在 handlers.ts）
- [x] 2.1.4 创建 `__tests__/mocks/ai-chat.ts` - AI Chat Mock（已包含在 handlers.ts）

### 2.2 测试数据
- [x] 2.2.1 创建 `__tests__/fixtures/users.ts` - 测试用户数据
- [x] 2.2.2 创建 `__tests__/fixtures/conversations.ts` - 测试对话数据
- [x] 2.2.3 创建 `__tests__/fixtures/tickets.ts` - 测试工单数据
- [x] 2.2.4 创建 `__tests__/fixtures/faq.ts` - 测试 FAQ 数据

### 2.3 认证 Mock
- [x] 2.3.1 创建 `__tests__/mocks/auth.ts` - NextAuth Mock
- [x] 2.3.2 实现 `mockSession()` 辅助函数
- [x] 2.3.3 实现角色切换辅助函数

---

## 3. 单元测试

### 3.1 Zod Schema 测试
- [x] 3.1.1 测试 `CreateConversationSchema`
- [x] 3.1.2 测试 `CreateMessageSchema`
- [x] 3.1.3 测试 `UpdateUserProfileSchema`
- [x] 3.1.4 测试 `SearchFAQSchema`
- [x] 3.1.5 测试 `FileUploadSchema`

### 3.2 工具函数测试
- [x] 3.2.1 测试 `src/lib/utils/api-response.ts`
- [x] 3.2.2 测试 `src/lib/utils/auth.ts`
- [x] 3.2.3 测试 `src/lib/utils/region-auth.ts`
- [x] 3.2.4 测试 `src/lib/utils/ai-config.ts`
- [x] 3.2.5 测试 `src/lib/env.ts`

### 3.3 本地存储测试
- [x] 3.3.1 测试 `createAIConversation()`
- [x] 3.3.2 测试 `getConversation()` / `getAllConversations()`
- [x] 3.3.3 测试 `addMessage()` / `getConversationMessages()`
- [x] 3.3.4 测试 `updateConversation()`
- [x] 3.3.5 测试 `deleteConversation()`
- [x] 3.3.6 测试未读计数相关函数

### 3.4 Zustand Store 测试
- [x] 3.4.1 测试 `src/lib/stores/` 下所有 store
- [x] 3.4.2 测试状态持久化
- [x] 3.4.3 测试状态重置

### 3.5 Zammad Client 测试
- [x] 3.5.1 测试 `getTicket()` / `getTickets()`
- [x] 3.5.2 测试 `createTicket()`
- [x] 3.5.3 测试 `updateTicket()`
- [x] 3.5.4 测试错误处理和重试逻辑
- [x] 3.5.5 测试 `X-On-Behalf-Of` 头部

---

## 4. API 集成测试

### 4.1 认证 API
- [x] 4.1.1 测试 `POST /api/auth/signin` - 登录
- [x] 4.1.2 测试 `POST /api/auth/signout` - 登出
- [x] 4.1.3 测试未认证请求返回 401
- [x] 4.1.4 测试会话过期处理

### 4.2 对话 API
- [x] 4.2.1 测试 `GET /api/conversations` - 列表
- [x] 4.2.2 测试 `POST /api/conversations` - 创建
- [x] 4.2.3 测试 `GET /api/conversations/[id]` - 详情
- [x] 4.2.4 测试 `PATCH /api/conversations/[id]` - 更新
- [x] 4.2.5 测试 `GET /api/conversations/[id]/messages` - 消息列表
- [x] 4.2.6 测试 `POST /api/conversations/[id]/messages` - 发送消息
- [x] 4.2.7 测试区域过滤逻辑

### 4.3 工单 API
- [x] 4.3.1 测试 `GET /api/tickets` - 列表
- [x] 4.3.2 测试 `POST /api/tickets` - 创建
- [x] 4.3.3 测试 `GET /api/tickets/[id]` - 详情
- [x] 4.3.4 测试 `PATCH /api/tickets/[id]` - 更新
- [x] 4.3.5 测试 `POST /api/tickets/[id]/articles` - 添加回复
- [x] 4.3.6 测试 Zammad 不可用时的降级处理

### 4.4 FAQ API
- [x] 4.4.1 测试 `GET /api/faq/categories` - 分类列表
- [x] 4.4.2 测试 `GET /api/faq/articles` - 文章列表
- [x] 4.4.3 测试 `GET /api/faq/articles/[id]` - 文章详情
- [x] 4.4.4 测试 `POST /api/faq/articles/[id]/rating` - 评分
- [x] 4.4.5 测试搜索功能

### 4.5 Admin API
- [x] 4.5.1 测试 `GET /api/admin/settings/ai` - 获取 AI 配置
- [x] 4.5.2 测试 `PUT /api/admin/settings/ai` - 更新 AI 配置
- [x] 4.5.3 测试 `POST /api/admin/settings/ai/test` - 测试 AI 连接
- [x] 4.5.4 测试非 Admin 用户返回 403
- [x] 4.5.5 测试用户管理 API

### 4.6 AI Chat API
- [x] 4.6.1 测试 `POST /api/ai/chat` - 正常响应
- [x] 4.6.2 测试 AI 禁用时返回 403
- [x] 4.6.3 测试请求体验证
- [x] 4.6.4 测试流式响应（如适用）

### 4.7 健康检查 API
- [x] 4.7.1 测试 `GET /api/health` - 健康状态
- [x] 4.7.2 测试各服务状态检测

---

## 5. E2E 测试

### 5.1 认证流程
- [x] 5.1.1 测试登录页面渲染
- [x] 5.1.2 测试成功登录跳转
- [x] 5.1.3 测试登录失败提示
- [x] 5.1.4 测试登出流程
- [x] 5.1.5 测试未登录重定向

### 5.2 Customer 流程
- [x] 5.2.1 测试 Dashboard 页面
- [x] 5.2.2 测试发起 AI 对话
- [x] 5.2.3 测试发送消息和接收 AI 回复
- [x] 5.2.4 测试转人工客服
- [x] 5.2.5 测试查看工单列表
- [x] 5.2.6 测试创建工单
- [x] 5.2.7 测试查看 FAQ
- [x] 5.2.8 测试 FAQ 搜索
- [x] 5.2.9 测试 FAQ 评分

### 5.3 Staff 流程
- [x] 5.3.1 测试 Staff Dashboard
- [x] 5.3.2 测试对话队列
- [x] 5.3.3 测试接受对话
- [x] 5.3.4 测试回复客户消息
- [x] 5.3.5 测试关闭对话
- [x] 5.3.6 测试工单列表
- [x] 5.3.7 测试工单处理
- [x] 5.3.8 测试工单状态更新

### 5.4 Admin 流程
- [x] 5.4.1 测试 Admin Dashboard
- [x] 5.4.2 测试 FAQ 分类管理
- [x] 5.4.3 测试 FAQ 文章管理
- [x] 5.4.4 测试 AI 配置页面
- [x] 5.4.5 测试 AI 配置保存
- [x] 5.4.6 测试用户管理

### 5.5 跨角色流程
- [x] 5.5.1 测试客户发起对话 → 客服接收
- [x] 5.5.2 测试客户创建工单 → 客服处理 → 客户查看
- [x] 5.5.3 测试实时消息同步

---

## 6. 测试报告与 CI/CD

### 6.1 报告配置
- [x] 6.1.1 配置 Vitest HTML 报告
- [x] 6.1.2 配置覆盖率报告（HTML + LCOV）
- [x] 6.1.3 配置 Playwright HTML 报告
- [x] 6.1.4 配置 JUnit XML 报告（CI 用）

### 6.2 GitHub Actions
- [x] 6.2.1 创建 `.github/workflows/test.yml`
- [x] 6.2.2 配置单元测试 Job
- [x] 6.2.3 配置 API 测试 Job
- [x] 6.2.4 配置 E2E 测试 Job（可选，仅 main 分支）
- [x] 6.2.5 配置测试报告上传（Artifacts）
- [ ] 6.2.6 配置覆盖率徽章

### 6.3 本地开发支持
- [x] 6.3.1 配置 Vitest UI（可视化测试界面）
- [x] 6.3.2 配置 Watch 模式
- [ ] 6.3.3 配置测试调试（VS Code）

---

## 7. 文档

### 7.1 测试指南
- [x] 7.1.1 创建 `docs/TESTING.md` - 测试指南
- [x] 7.1.2 编写如何运行测试
- [x] 7.1.3 编写如何编写新测试
- [x] 7.1.4 编写 Mock 使用指南
- [x] 7.1.5 编写 E2E 测试编写指南

### 7.2 手动测试用例
- [ ] 7.2.1 创建 `docs/MANUAL-TEST-CASES.md`
- [ ] 7.2.2 编写 Customer Portal 测试用例
- [ ] 7.2.3 编写 Staff Portal 测试用例
- [ ] 7.2.4 编写 Admin Panel 测试用例
- [ ] 7.2.5 编写跨浏览器测试用例
- [ ] 7.2.6 编写移动端测试用例

---

## 8. 质量门禁

### 8.1 覆盖率要求
- [x] 8.1.1 配置最低覆盖率阈值（80%）
- [ ] 8.1.2 配置 PR 覆盖率检查
- [ ] 8.1.3 配置覆盖率下降警告

### 8.2 测试通过要求
- [ ] 8.2.1 配置 PR 必须测试通过
- [ ] 8.2.2 配置主分支保护规则
- [ ] 8.2.3 配置测试失败通知

---

## 9. 特殊场景测试

### 9.1 国际化 (i18n) 测试
- [x] 9.1.1 测试语言切换功能
- [x] 9.1.2 测试翻译键完整性（所有 key 在所有语言中存在）
- [x] 9.1.3 测试日期/数字本地化格式
- [x] 9.1.4 测试 6 种语言的 UI 渲染

### 9.2 SSE 实时通信测试
- [x] 9.2.1 测试 SSE 连接建立
- [x] 9.2.2 测试 SSE 事件接收
- [x] 9.2.3 测试 SSE 断开重连
- [x] 9.2.4 测试心跳机制
- [x] 9.2.5 测试多客户端同步

### 9.3 文件上传测试
- [x] 9.3.1 测试文件大小限制（50MB）
- [x] 9.3.2 测试 MIME 类型白名单
- [x] 9.3.3 测试无效文件拒绝
- [x] 9.3.4 测试上传成功响应

### 9.4 权限与区域测试
- [x] 9.4.1 测试 Customer 数据隔离
- [x] 9.4.2 测试 Staff 区域限制
- [x] 9.4.3 测试 Admin 全局访问
- [x] 9.4.4 测试跨角色越权访问拒绝
- [x] 9.4.5 测试区域过滤逻辑

### 9.5 错误处理测试
- [x] 9.5.1 测试 API 错误响应格式一致性
- [x] 9.5.2 测试网络错误处理
- [x] 9.5.3 测试 Zammad 不可用降级
- [x] 9.5.4 测试 AI 服务不可用降级
- [x] 9.5.5 测试表单验证错误显示

### 9.6 边界条件测试
- [x] 9.6.1 测试空数据列表显示
- [x] 9.6.2 测试大数据量分页
- [x] 9.6.3 测试长文本截断
- [x] 9.6.4 测试特殊字符处理
- [x] 9.6.5 测试并发请求处理

### 9.7 页面加载测试
- [x] 9.7.1 测试 Customer FAQ 页面加载（发现有卡住问题）
- [x] 9.7.2 测试 Customer 工单页面加载（发现有卡住问题）
- [x] 9.7.3 测试页面加载超时处理
- [x] 9.7.4 测试加载状态显示

### 9.8 系统健康状态测试
- [x] 9.8.1 测试 Admin Dashboard 系统状态显示
- [x] 9.8.2 测试 API 状态检测
- [x] 9.8.3 测试数据库连接状态
- [x] 9.8.4 测试 Zammad 集成状态
- [x] 9.8.5 测试 FastGPT 连接状态
- [x] 9.8.6 测试 FastGPT 连接测试按钮

### 9.9 实时更新测试
- [x] 9.9.1 测试 Staff 对话列表实时更新指示器
- [x] 9.9.2 测试工单列表 Live 状态指示
- [x] 9.9.3 测试新消息实时推送

---

## 10. 可访问性测试 (Accessibility)

### 10.1 基础可访问性
- [x] 10.1.1 测试键盘导航
- [x] 10.1.2 测试屏幕阅读器兼容性
- [x] 10.1.3 测试颜色对比度
- [x] 10.1.4 测试 ARIA 标签

### 10.2 自动化可访问性检查
- [x] 10.2.1 集成 axe-core 到 E2E 测试
- [x] 10.2.2 配置可访问性违规报告

---

## 完成标准

- [x] 所有测试配置文件已创建并可运行
- [ ] 单元测试覆盖率 ≥80%
- [x] 所有 API 端点有对应测试
- [x] 关键业务流程有 E2E 测试 (81 个测试全部通过)
- [ ] CI/CD 流水线正常运行
- [x] 测试报告自动生成 (Playwright HTML Reporter)
- [x] 文档完整且可用

---

## 测试审查记录 (2024-12)

### E2E 测试修复
- 修复了 51 个失败的测试
- 主要问题：选择器匹配多个元素、networkidle 超时、元素文本不匹配
- 修复原则：基于真实 UI、不为通过而写、不过度严格
