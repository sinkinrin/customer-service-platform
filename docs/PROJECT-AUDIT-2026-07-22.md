# 项目全面审计记录（2026-07-22）

> 状态：进行中。本文只记录已经由代码、锁文件或可复现命令支持的结论；未证明可达性的漏洞不写成已被利用。

## 审计边界

- 未连接生产或共享 PostgreSQL。
- 未连接真实 Zammad、AI provider 或 webhook。
- 测试和构建使用 `127.0.0.1` 不可连接端口及名称包含 `test` 的占位数据库。
- 后续修改位于独立 worktree `customer-service-platform-audit` 的 `audit/project-review` 分支。

## 第一阶段：基线与工具链

### 已确认基线

- 基线提交：`22ea3b6 chore(audit): establish isolated test baseline`。
- 本地验证运行时：Node `22.17.1`、npm `10.9.2`。
- 锁定安装版本：Next `16.2.6`、React `19.2.1`、TypeScript `5.9.3`、Prisma `6.19.3`、Vite `8.1.3`、Vitest `4.1.9`。
- 基线已通过：ESLint（0 error / 18 warning）、TypeScript、完整 Vitest、当前 CI 覆盖率门槛、i18n 校验、生产构建、GitHub Actions YAML 解析。
- 一次把覆盖率与生产构建并行执行时，`conversation-detail-history` 有一个 10 秒超时；该文件单独运行 46/46 通过，覆盖率串行重跑通过。当前证据支持“资源竞争下的脆弱测试”，不支持“稳定功能回归”。

### AUD-001：生产依赖仍有未解决的高危漏洞链（P1，未修复）

证据：

- `npm audit --omit=dev --json` 在补丁升级前报告 4 high / 1 low；升级 DOMPurify 与 brace-expansion 后剩余 3 high。
- 剩余条目是同一条生产链的不同节点：`@scalar/nextjs-api-reference -> next -> sharp@0.34.5`。
- `npm view next@16.2.11 optionalDependencies` 仍声明 `sharp: ^0.34.5`；当前 Sharp 最新版为 `0.35.3`，已超出 Next 声明的兼容范围。
- npm 给出的自动修复建议会把 Next 降到 `14.2.35`，这不是本项目可接受的安全修复方案。

影响与结论：

- 漏洞位于生产依赖，不应因“自动修复建议不合理”而忽略。
- 当前尚未证明应用存在可被外部用户控制的 Sharp/libvips 触发路径，因此不声称漏洞已可利用。
- 暂不强制 override 到 Sharp 0.35，也不降级 Next。应跟踪 Next 对 Sharp 0.35 的兼容版本，或在隔离分支验证显式 override、图片优化调用面和回滚方案。

### AUD-002：CI 没有生产构建门禁（P1，已修复）

证据：

- 原 `.github/workflows/test.yml` 只有覆盖率、E2E（默认禁用）和 lint/type-check job。
- `npm run build` 还会执行 Prisma Client 生成、Next 编译、路由收集和静态页面生成，这些不被 `tsc --noEmit` 覆盖。

修复：

- 新增隔离的 `Production Build` job。
- 使用不可连接 PostgreSQL/Zammad 占位地址、关闭欢迎邮件和 mock auth，不执行迁移、seed 或 E2E。

### AUD-003：示例环境文件存在危险且漂移的默认值（P1，已修复）

证据：

- 原 `AUTH_SECRET=your_auth_secret_here_at_least_32_chars` 长度足以通过生产校验，但值完全可预测。
- 原 `ZAMMAD_URL` 指向具体私网地址，不适合作为可复制的公共示例。
- 原文件仍声明已经没有代码引用的 `SOCKET_IO_PORT`，同时遗漏 cron、AI QA、存储 bucket 等当前配置项。
- mock auth 注释声称生产可开启，但 `validateEnv()` 实际会硬失败。

修复：

- 示例 auth secret 改为必然无法通过生产长度校验的 `replace-me`。
- Zammad 改为不可连接的 loopback 占位地址。
- 删除 Socket.IO 遗留项，补齐当前可选配置并修正文案。

### AUD-004：环境变量测试没有测试生产代码（P2，已修复）

证据：

- 原 `__tests__/unit/env.test.ts` 在测试内部重新实现 `validateEnv`、`getEnv`、`isMockAuthEnabled` 等函数，没有导入 `src/lib/env.ts`。
- 旧测试甚至断言“生产明确启用 mock auth 时返回 true”，而真实实现始终返回 false，且真实校验会抛错；测试全绿仍无法发现这种分歧。

修复：

- 改为动态导入并直接调用真实模块。
- 覆盖生产必需变量、短密钥、mock auth、webhook secret、欢迎邮件 URL、兼容 secret、缓存验证和布尔解析。

### AUD-005：Node 版本要求没有在项目中声明（P2，已修复）

证据：

- Next 16.2.6 要求 Node `>=20.9.0`。
- Vite 8.1.3 要求 `^20.19.0 || >=22.12.0`。
- Vitest 4.1.9 支持 Node 20、22 和 24+，不支持 Node 21/23。
- 原 `package.json` 没有 `engines` 或 `packageManager`，CI 只指定主版本 `20`。

修复：

- 声明共同支持范围 `^20.19.0 || ^22.12.0 || >=24.0.0` 和 npm `10.9.2`。

### AUD-006：Prisma seed 仍使用即将删除的配置入口（P2，已修复）

证据：

- 构建明确警告 `package.json#prisma` 将在 Prisma 7 删除。
- `prisma.config.ts` 已存在并覆盖旧配置。
- Prisma 6.19.3 的 `MigrationsConfigShape` 明确支持 `migrations.seed`。

修复：

- 将 `tsx prisma/seed.ts` 移入 `prisma.config.ts`，删除 `package.json#prisma`。

### AUD-007：Next 与 ESLint 工具链跨主版本（P2，待处理）

证据：

- 应用是 Next `16.2.6`，但安装的是 `eslint-config-next@15.5.7` 与 ESLint `8.57.1`。
- `eslint-config-next@16.2.11` 要求 ESLint `>=9.0.0`，说明正确对齐不是单包 patch，而是 flat config / ESLint 9 迁移。

结论：

- 当前 lint 可运行，因此不把它写成已发生的构建故障。
- 现有规则集无法代表 Next 16 当前规则基线。应单独迁移并比较规则差异，不能只改版本号。

### AUD-008：生产构建文件追踪过宽（P2，部分修复）

证据：

- 基线构建时 Turbopack 指出 `src/lib/file-storage.ts:61` 的动态路径匹配项目内约 10,382 个文件，并追踪到 `next.config.js`。
- 首次构建时 Browserslist 提示 `caniuse-lite` 已陈旧 7 个月。

结论：

- 已将 `caniuse-lite` 从 `1.0.30001759` 更新到 `1.0.30001806`，目标浏览器集合没有变化。
- 本批最终构建不再打印 10,382 文件和 Browserslist 警告，但仍报告 `next.config.js` 出现在 NFT 列表，import trace 仍指向 `file-storage.ts` 和头像 API。
- 动态文件路径可能增加构建耗时、部署包体和意外文件追踪。该问题仍需验证上传目录、standalone/NFT 产物和部署读取路径，再修改文件存储实现；不能仅凭警告数量下降宣称根因已修复。

### AUD-009：类型检查和测试依赖工作目录里已有 Prisma Client（P1，已修复）

证据：

- 在独立 worktree 执行干净 `npm ci` 后，直接运行 `npm run type-check` 出现大量 Prisma model/type 缺失错误。
- 执行 `prisma generate` 后这些类型才会存在。
- 原 lint CI 会手工生成 Prisma Client，但 unit/coverage job 不会；本地脚本是否成功取决于此前是否运行过 build/generate。

修复：

- 新增 `npm run prisma:generate`。
- `type-check`、Vitest、watch、UI 和覆盖率脚本均在启动前显式生成 Prisma Client。
- 移除 lint job 的重复生成步骤，使相同入口在本地和 CI 中行为一致。

## 本阶段依赖处置

- DOMPurify：`3.4.11 -> 3.4.12`，修复 low advisory。
- brace-expansion：`1.1.14 -> 1.1.16`、`2.1.0 -> 2.1.2`，修复 high advisory。
- caniuse-lite：`1.0.30001759 -> 1.0.30001806`，消除陈旧浏览器数据警告；目标浏览器集合不变。
- 未执行 `npm audit fix --force`，因为其建议包含 Next 主版本倒退。

## 已执行命令

```text
npm run lint
npm run type-check
npm run test
npm run test:coverage:ci
npm run i18n:validate
npm run build
npm ci
npx prisma validate
npm audit --omit=dev --json
npm audit --json
npm outdated --json
npm ls ... --depth=0
npm view next@16.2.11 optionalDependencies engines
npm view eslint-config-next@16.2.11 peerDependencies
```

## 本批验证结果

- `npm ci`：通过；仍显示 3 个 high，均属于 AUD-001 链路。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过，并从脚本内生成 Prisma Client。
- `npm run test`：通过；真实环境配置测试 13/13 通过，真实数据库集成测试默认跳过。
- `npm run test:coverage:ci`：通过当前防回退门槛；statements 66.48%、branches 51.73%、functions 66.64%、lines 67.80%。
- `npm run i18n:validate`：通过。
- `npx prisma validate`：通过。
- GitHub Actions YAML 解析：通过。
- 将 `.env.example` 解析为生产环境后调用真实 `validateEnv()`：按预期因短 `AUTH_SECRET` 拒绝启动。
- 隔离生产构建：通过；Prisma 弃用与 Browserslist 陈旧警告消失，剩余 1 个 NFT 文件追踪警告。

## 下一步

1. 完成本批修改的锁文件、YAML、单测、lint、类型检查、覆盖率和隔离构建验证。
2. 进入“安全与权限”阶段，优先审查认证回退、管理员 API、文件访问、webhook 签名和代理身份头。
3. 对 Sharp/Next 漏洞链建立独立兼容性验证，不把 npm 的错误降级建议直接应用到主线。
