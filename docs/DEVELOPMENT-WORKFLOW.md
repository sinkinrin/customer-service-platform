# 开发与测试工作流

> 当前项目的实现核对、修改、验证和文档协作流程。

## 工作前

1. 阅读根目录 `AGENTS.md`。
2. 涉及规划、重大能力、架构或安全变更时，再阅读 `openspec/AGENTS.md`、`openspec/project.md` 和相关规格。
3. 使用 `rg` 和直接文件读取定位实现，不使用语义检索工具。
4. 先检查 `git status`，保留已有未提交修改，不覆盖无关文件。
5. 以代码、`package.json`、Prisma schema、测试和当前文档共同确认现状。

## 修改位置

| 内容 | 位置 |
|---|---|
| 当前实现、运维和测试说明 | `docs/` |
| 长期有效的行为约束 | `openspec/specs/` |
| 页面和 API | `src/app/` |
| 共享业务逻辑 | `src/lib/` |
| 数据模型和迁移 | `prisma/` |
| 单元、组件、API 和场景测试 | `__tests__/` |
| 浏览器端流程 | `e2e/` |

不要把一次性计划、已完成任务或过时 proposal 重新写入 OpenSpec。

## 典型修改流程

1. 明确用户可见行为、影响模块和不在范围内的内容。
2. 检查对应实现、类型、配置、测试和文档。
3. 优先复用现有 client、service、provider、helper 和 response 约定。
4. 在 API 边界、表单和外部依赖处保留输入校验与错误处理。
5. 同步更新受影响测试；涉及认证、工单、AI、通知、权限或 API 合约时，不要只改页面。
6. 更新当前实现文档；若内容属于长期约束，再更新 OpenSpec。

## 验证矩阵

```bash
npm run lint            # ESLint
npm run type-check      # TypeScript
npm run test            # Vitest
npm run test:coverage   # 需要覆盖率时
npm run test:e2e        # 页面、认证和关键流程
npm run i18n:check      # 多语言或文案变更
npm run build           # 依赖、路由、构建配置或发布前检查
```

## 生产隔离规则

1. 默认验证不得连接生产 PostgreSQL、Zammad 或 AI provider；在 shell 中显式覆盖为测试地址，不依赖来源不明的 `.env.local`。
2. 不在生产或共享数据库执行 `prisma migrate`、`prisma db push`、seed、测试清理脚本。
3. `npm run test:e2e` 可能创建真实业务对象，仅允许在独立数据库和隔离 Zammad / mock 环境运行。
4. 真实数据库集成测试必须显式设置 `RUN_DATABASE_INTEGRATION_TESTS=true`，且数据库名必须包含 `test`。
5. 需要验证生产配置时，优先做静态检查或只读健康检查；任何写操作都必须由用户明确批准并说明回滚方式。

普通 Vitest、覆盖率和构建可使用不可连接的本地占位地址，防止测试代码意外落到生产服务。连接失败日志可能是隔离措施的预期结果，最终判断以退出码和测试断言为准。

建议至少执行：

- 共享逻辑或 API：`npm run test` + `npm run type-check`
- 页面或交互：再执行相关 Playwright 测试或 `npm run test:e2e`
- 认证、工单、权限、AI、通知：执行对应测试，并在需要时进行真实界面验证
- 依赖、环境变量或 Next.js 配置：增加 `npm run lint` 和 `npm run build`

## 文档核对原则

- 文档与代码冲突时，先信代码，再修正文档。
- 不维护固定 API 数量、测试数量或容易变化的目录快照。
- 工单事实来源是 Zammad；FAQ、通知、评分、上传元数据、AI 对话等是本地 Prisma 支撑数据。
- 当前分配模型以 customer-staff binding 和 service group 为核心，不能退回描述为单纯 region 分配。
- AI 不是 FastGPT-only；运行时 provider 由配置层统一选择。

## 交付要求

交付说明至少包含：

- 修改了哪些文件和行为
- 实际运行了哪些验证命令
- 哪些检查因环境依赖未执行
- 是否存在需要后续处理的安全、迁移或兼容性风险
- 验证使用的环境类型，以及是否确认未触达生产 Zammad / 数据库

禁止提交真实密钥、密码、token、客户数据和 `.env.local` 内容。
