# 变更：建立自动化测试体系

## 原因

项目当前**完全没有测试基础设施**：
- 无测试框架配置（Jest/Vitest）
- 无任何测试文件（*.test.ts / *.spec.ts）
- 无 E2E 测试（Playwright）
- 无测试覆盖率报告
- 无 CI/CD 测试流水线

这导致：
1. **代码质量风险** - 重构和新功能可能引入回归 Bug
2. **部署信心不足** - 无法确认变更是否破坏现有功能
3. **协作效率低** - 代码审查缺乏自动化验证
4. **文档缺失** - 测试即文档，当前无法通过测试了解系统行为

## 变更内容

### 阶段1：测试基础设施（P0）
- 配置 Vitest 作为单元/集成测试框架
- 配置 Playwright 作为 E2E 测试框架
- 配置测试覆盖率报告（Istanbul/c8）
- 配置 HTML 测试报告生成
- 添加 `package.json` 测试脚本

### 阶段2：单元测试（P1）
- **Zod Schema 测试** - 验证所有输入校验逻辑
- **工具函数测试** - `src/lib/utils/` 下所有工具
- **Zustand Store 测试** - 状态管理逻辑
- **本地存储测试** - `local-conversation-storage.ts`
- **Zammad Client 测试** - API 客户端（Mock）

### 阶段3：API 集成测试（P1）
- **认证 API** - `/api/auth/*` 登录/登出/会话
- **对话 API** - `/api/conversations/*` CRUD + 消息
- **工单 API** - `/api/tickets/*` Zammad 集成
- **FAQ API** - `/api/faq/*` 查询/评分
- **Admin API** - `/api/admin/*` 权限控制
- **AI Chat API** - `/api/ai/chat` AI 响应

### 阶段4：E2E 测试（P2）
- **Customer 流程** - 登录 → AI 对话 → 转人工 → 工单 → FAQ
- **Staff 流程** - 登录 → 对话队列 → 回复 → 工单处理
- **Admin 流程** - 登录 → FAQ 管理 → AI 配置 → 用户管理
- **跨角色流程** - 客户提交 → 客服处理 → 客户确认

### 阶段5：测试报告与 CI/CD（P1）
- **HTML 测试报告** - 自动生成可视化报告
- **覆盖率报告** - 代码覆盖率统计
- **GitHub Actions** - PR 自动运行测试
- **测试结果通知** - 失败时通知相关人员

### 阶段6：手动测试支持（P2）
- **测试用例文档** - 手动测试检查清单
- **测试数据管理** - 测试账号和数据准备脚本
- **测试环境隔离** - 独立测试数据库配置

## 影响

### 受影响的规范
- 无现有规范受影响（新增测试能力）

### 受影响的代码
- **新增配置文件**：
  - `vitest.config.ts` - Vitest 配置
  - `playwright.config.ts` - Playwright 配置
  - `.github/workflows/test.yml` - CI 测试流水线

- **新增测试目录**：
  - `__tests__/unit/` - 单元测试
  - `__tests__/api/` - API 集成测试
  - `__tests__/e2e/` - E2E 测试
  - `__tests__/fixtures/` - 测试数据
  - `__tests__/mocks/` - Mock 实现

- **新增文档**：
  - `docs/TESTING.md` - 测试指南
  - `docs/MANUAL-TEST-CASES.md` - 手动测试用例

- **修改文件**：
  - `package.json` - 添加测试依赖和脚本
  - `tsconfig.json` - 测试类型配置

### 新增依赖
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@playwright/test": "^1.45.0",
    "msw": "^2.3.0",
    "happy-dom": "^14.0.0"
  }
}
```

### 破坏性变更
- **无** - 纯新增功能

## 优先级

**整体优先级**：🔴 P0（最高优先级）

测试是保障代码质量的基础，应在其他功能开发前建立。

## 预期收益

1. **代码质量保障** - 自动检测回归 Bug
2. **部署信心提升** - 测试通过才能部署
3. **开发效率提高** - 快速验证代码变更
4. **文档即测试** - 测试用例描述系统行为
5. **协作更顺畅** - PR 自动验证，减少人工审查负担

## 测试报告示例

### 自动生成的报告类型

| 报告类型 | 格式 | 用途 |
|----------|------|------|
| 单元测试报告 | HTML | 查看测试用例执行结果 |
| 覆盖率报告 | HTML/LCOV | 查看代码覆盖情况 |
| E2E 测试报告 | HTML | 查看端到端测试结果 |
| Playwright Trace | ZIP | 调试失败的 E2E 测试 |

### 报告输出位置
```
coverage/           # 覆盖率报告
  ├── index.html    # 覆盖率概览
  └── lcov.info     # CI 集成用
test-results/       # 测试结果
  ├── html/         # HTML 报告
  └── junit.xml     # CI 集成用
playwright-report/  # E2E 报告
  └── index.html    # Playwright 报告
```

## 测试策略

### 测试金字塔
```
        ┌─────────────┐
        │   E2E (10%) │  ← 关键业务流程
        ├─────────────┤
        │ API (30%)   │  ← 40+ API 端点
        ├─────────────┤
        │ Unit (60%)  │  ← 工具函数、Schema、Store
        └─────────────┘
```

### Mock 策略

| 外部依赖 | Mock 方式 | 说明 |
|----------|-----------|------|
| Zammad API | MSW | 拦截 HTTP 请求 |
| AI Chat (FastGPT) | MSW | 固定响应 |
| NextAuth Session | vi.mock | 模拟认证状态 |
| Prisma | 内存 SQLite | 真实数据库操作 |
| 文件系统 | memfs | 测试本地存储 |
| SSE 连接 | EventSource Mock | 模拟实时事件 |

### 覆盖率目标

| 类型 | 目标覆盖率 | 说明 |
|------|-----------|------|
| 语句覆盖 | ≥80% | 代码执行覆盖 |
| 分支覆盖 | ≥70% | 条件分支覆盖 |
| 函数覆盖 | ≥85% | 函数调用覆盖 |
| 行覆盖 | ≥80% | 代码行覆盖 |

## 特殊测试场景

### 国际化 (i18n) 测试
项目支持 6 种语言（en, zh-CN, fr, es, ru, pt），需要测试：
- 语言切换功能
- 翻译键完整性
- 日期/数字格式化
- RTL 布局（如需支持阿拉伯语）

### SSE 实时通信测试
项目使用 SSE 进行实时更新，需要测试：
- SSE 连接建立和断开
- 事件接收和处理
- 重连机制
- 心跳检测

### 文件上传测试
- 文件大小限制验证
- MIME 类型验证
- 上传进度（如适用）
- 错误处理

### 多角色权限测试
- Customer 只能访问自己的数据
- Staff 只能访问分配区域的数据
- Admin 可以访问所有数据
- 跨角色数据隔离

### 区域 (Region) 过滤测试
项目有区域概念（asia-pacific, europe, americas），需要测试：
- 用户区域分配
- 数据区域过滤
- 跨区域访问限制
