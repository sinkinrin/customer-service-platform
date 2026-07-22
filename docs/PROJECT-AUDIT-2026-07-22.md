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

## 第二阶段：安全与权限

### AUD-010：公开健康检查泄露内部配置和连接错误（P1，已修复）

证据：

- `PUBLIC_ROUTES` 以路径前缀匹配 `/api/health`，因此 `/api/health` 和 `/api/health/zammad` 均允许匿名访问。
- 修复前 `/api/health` 会返回 `NODE_ENV`、版本、mock auth 状态、认证密钥/Zammad/数据库是否配置，以及 Prisma/Zammad 的原始错误消息。
- Prisma 连接错误通常包含数据库主机和端口；Zammad 网络错误也可能包含内部地址。
- 修复前 `/api/health/zammad` 会把 `checkZammadHealth().error` 直接作为公开错误消息。

修复：

- 匿名和非管理员调用只得到总体状态、组件粗粒度状态、时间戳和响应耗时。
- 已登录管理员仍可取得原有版本、环境、配置状态和诊断消息，保持管理员 dashboard 兼容。
- Zammad 专用健康检查对外只返回通用不可用消息；原始错误仍留在服务端诊断路径。
- 新增回归断言，确认匿名响应不包含内部 IP、`config`、`environment`、`version` 或组件错误文本。

### AUD-011：AI health 可被任意登录用户调用并泄露上游信息（P1，已修复）

证据：

- `/api/ai/health` 不属于公开路由，middleware 只要求“已登录”；共享角色矩阵不匹配 `/api/ai/*`。
- 修复前 route 内没有 `requireRole()`，任何 customer/staff/admin session 都可触发一次携带真实 FastGPT API key 的 POST 请求。
- 成功响应返回 FastGPT URL 和模型；失败响应返回上游 body、网络错误文本和上游 URL。

修复：

- route 入口显式要求 `admin`。
- 对未登录和非管理员调用分别返回 401/403，且权限失败时不读取 AI 配置、不请求上游。
- 响应不再返回 FastGPT URL、模型、上游 body 或网络异常文本；详细错误只写服务端日志。
- 新增 admin 角色、上游 HTTP 错误和网络错误回归测试。

### AUD-012：共享角色矩阵没有覆盖 API namespace（P2，待架构加固）

证据：

- `ROLE_ROUTES` 的前缀只有 `/admin`、`/staff`、`/customer`。
- `/api/admin/...` 不以 `/admin` 开头，`/api/staff/...` 也不以 `/staff` 开头，因此 middleware 中面向 `/api/admin`、`/api/staff` 的 403 分支无法由当前矩阵触发。
- 对 `src/app/api/admin` 和 `src/app/api/staff` 的 58 个导出 HTTP 方法做逐方法精确扫描，当前每个方法体都至少包含 route-level 认证和角色检查标记；本轮没有据此发现可直接利用的未保护方法。

影响与结论：

- 当前安全性依赖每个 route 自己正确调用 `requireRole()` 或进行等价手写检查，新增 route 很容易漏掉。
- 不能把 middleware 当成管理员/坐席 API 的第二道角色防线。后续应让 API namespace 进入共享矩阵，并保留 route-level 检查作为纵深防御。
- `/api/admin/faq` 的只读 GET 明确允许 staff 且返回包括草稿在内的全部 FAQ；当前只发现 admin 页面调用它，是否为有意授权仍需业务确认，暂不擅自收紧。

### AUD-013：Zammad 失败后会尝试长期 env fallback 账号（P1，待决策）

证据：

- `validateCredentials()` 的顺序是 Zammad、mock auth、`AUTH_DEFAULT_USER_*`。
- `authenticateWithZammad()` 捕获连接和认证异常后返回 `null`，随后流程会继续尝试 env credential。
- `AUTH_DEFAULT_USER_ROLE` 缺失或无效时默认得到 `staff`；该路径不要求单独的显式启用开关。
- 当前认证文档也将其描述为“应急 / 开发兜底，而不是正式生产身份模型”。

影响与结论：

- 只要生产配置了这组固定凭据，它就是独立于 Zammad 生命周期、在 Zammad 故障时仍可登录的长期旁路账号。
- 直接删除可能切断现有应急登录，不在本批贸然修改。建议迁移为显式 server-side 开关、强制显式角色、启动期告警/审计，并为紧急启用建立短期凭据和轮换流程。

### AUD-014：登录限流按邮箱而不是 IP，既可定向锁号也可跨实例绕过（P1，待修复）

证据：

- 注释声称登录限制是“每 IP 15 分钟 10 次”，实际 key 是 `login:${normalizedEmail}`。
- 第 11 次尝试会在校验密码之前抛出 `RATE_LIMIT_EXCEEDED`，因此攻击者只需知道邮箱即可让该邮箱在当前实例被拒绝登录。
- limiter 使用进程内 `Map`；切换实例或重启进程会得到独立计数。

影响与结论：

- 当前实现同时存在定向账户拒绝服务和水平扩容下暴力尝试绕过。
- 需要先确认可信代理链和 NextAuth `authorize` 可取得的安全客户端 IP，再改为 IP 与账号维度的组合限流；多实例部署应使用共享存储。未在缺少代理信任模型时直接相信任意 `x-forwarded-for`。

### AUD-015：非 production 环境无条件开放管理员 auto-login（P2，待加固）

证据：

- middleware 对所有 `/api/dev/*` 在非 production 环境直接放行。
- `/api/dev/auto-login` 只检查 `NODE_ENV !== 'production'`，随后允许调用者选择 customer、staff 或 admin，并返回 mock session。
- route 不要求独立的 server-side enable flag。

影响与结论：

- 正式 production build 被 middleware 和 route 双重阻止；当前没有生产直达证据。
- 若 staging、演示或临时环境以非 production 模式对外暴露，匿名用户可直接取得管理员 mock session。应增加默认关闭的 server-side 开关，并让 staging 保持关闭。

### AUD-016：API 广泛把内部异常返回给调用方（P1，部分修复）

证据：

- `serverErrorResponse()` 会把第二个参数放入响应 `error.details`，把第一个参数作为公开 message。
- 精确搜索在 `src/app/api` 找到 195 处 `serverErrorResponse` 引用，其中至少 68 处在同一行直接传入 `error.message`。
- 匿名可达的 webhook 和 FAQ route 也存在把原始异常作为公开 message 的路径；数据库、网络和第三方 API 异常可能包含主机、端口、上游响应或实现细节。

结论：

- 已分批修复健康检查、AI health、webhook、公开 FAQ 和本地文件 API 的确定泄露面。
- 后续应优先清理匿名 route，再治理已认证 route；服务端保留带 request ID 的详细日志，客户端统一返回稳定错误码和通用消息。全局修改 helper 可能影响现有前端错误契约，应分批加测试而不是一次性静默丢弃所有 details。

### AUD-017：webhook 在验签前解析无上限 body，并返回原始异常（P1，已修复）

证据：

- 修复前 route 先执行 `request.text()` 和 `JSON.parse()`，之后才检查 HMAC；无效签名请求仍会消耗完整 body 读取与 JSON 解析资源。
- 没有显式 body size 上限；公开调用方可以发送远大于正常 Zammad webhook 的请求体。
- JSON 语法错误和内部异常会进入最外层 catch，并把原始 `error.message` 作为 500 响应消息。
- 缺少 `ticket` 时会把整个解析后的 payload 写入日志，可能记录不必要的客户内容。

修复：

- 新增 1 MiB 上限：先检查声明长度，同时对实际 `ReadableStream` 按字节累计并在超限时取消读取，不能只依赖客户端 header。
- bounded raw body 读取后先验签，再解析 JSON；无效签名不再进入 JSON 解析。
- 超限返回 413，非法 JSON 返回稳定 400，意外异常返回通用 500；详细错误只写服务端日志。
- 无效 payload 日志不再附带整个 body。

### AUD-018：公开 FAQ 可绕过缓存，输入解析宽松且泄露数据库异常（P2，已修复）

证据：

- `/api/faq` 是匿名路由，修复前任何人都可传 `forceRefresh=true` 跳过内存缓存；精确搜索只发现 route 和测试使用该参数，admin mutation 本身已经会清理 FAQ cache。
- `parseInt()` 让 `limit=1.5`、`categoryId=1abc` 等非规范值被截断接受，而 `limit=abc` 的 `NaN` 可绕过范围比较并进入 Prisma。
- FAQ list/detail/categories/rating 的 catch 会把数据库原始异常作为 message 或 details 返回。
- categories route 仍带有 SQLite 专用错误文案，但当前数据库是 PostgreSQL。

修复：

- 公共 `forceRefresh` 不再影响缓存；管理员写操作继续通过已有 `faqCache.clear()`/`categoriesCache.clear()` 生效。
- limit、category/article ID 改为严格整数校验，搜索词限制为 200 字符，rating 非法 JSON 返回 400。
- FAQ 错误响应统一为稳定通用消息，原始数据库异常只进入服务端日志。

### AUD-019：本地文件路径没有 uploads containment 校验（P2，已加固）

证据：

- 修复前 upload/read/delete 都直接对 bucket 或数据库中的 `filePath` 执行 `path.join(UPLOAD_BASE_DIR, ...)`。
- 当前正常上传路径由受控 reference type、环境 bucket、UUID 和文件扩展生成；本轮没有证明远程用户可直接写入任意数据库 `filePath`，因此不把它描述为已可利用的路径穿越。
- 但错误环境 bucket、损坏/迁移数据或未来新增写路径一旦包含 `..`/绝对路径，就可能让文件操作离开 `uploads`。

修复：

- 所有 upload/read/delete 路径统一经 `path.resolve()` + `path.relative()` containment 检查。
- 空路径、父目录逃逸和绝对路径均在任何 mkdir/read/write/unlink 前拒绝。
- 新增安全路径、存储记录逃逸和 bucket 逃逸单测。

### AUD-020：webhook 限流信任代理头且仅在单进程内生效（P2，待部署边界确认）

证据：

- webhook limiter key 取 `x-forwarded-for` 的第一个值；若边缘代理不覆盖客户端传入值，调用方可伪造不同 IP 绕过限制。
- limiter 与登录限流一样使用进程内 `Map`，跨实例不共享。
- 当前仓库没有声明可信代理层如何重写 `x-forwarded-for`，无法仅凭应用代码判断该头是否可信。

结论：

- 暂不盲目改成全局 key：公开攻击者可先耗尽全局窗口，从而阻断真实 Zammad webhook。
- 部署侧应确认唯一可信代理及 header overwrite 规则；之后再选择共享存储的 source/IP + signature-aware 限流。1 MiB body 上限已经先降低单请求资源风险。

### 本轮权限边界核对结果

- `X-On-Behalf-Of` 只在 Zammad client 内构造；当前 route 传入值来自已认证 session 的 `user.email`，没有发现从客户端请求头透传代理身份的代码路径。
- 本地 `/api/files/[id]` metadata/download 已检查 owner 或 admin，delete 会把当前 user ID 传入存储层；当前没有发现直接的跨用户本地文件读取。
- 本地文件的 upload/read/delete 已统一增加 `uploads` 基目录 containment；仍需在部署产物中验证持久卷、symlink 和 NFT trace 行为。

## 已完成的依赖处置

- DOMPurify：`3.4.11 -> 3.4.12`，修复 low advisory。
- brace-expansion：`1.1.14 -> 1.1.16`、`2.1.0 -> 2.1.2`，修复 high advisory。
- caniuse-lite：`1.0.30001759 -> 1.0.30001806`，消除陈旧浏览器数据警告；目标浏览器集合不变。
- 未执行 `npm audit fix --force`，因为其建议包含 Next 主版本倒退。

## 已执行命令（累计）

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
rg / targeted PowerShell scans for API role checks, impersonation, file access and error responses
npm run test -- __tests__/unit/health-check.test.ts __tests__/api/health-zammad.test.ts __tests__/api/ai.test.ts
```

## 第一批验证结果

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

## 第二批验证结果

- 健康检查与 AI health 定向测试：3 个文件、32 个测试通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test`：在不可连接数据库/Zammad 占位地址下通过；第一次人为设置测试环境 webhook secret 后，两个无签名 orchestration case 按代码返回 401，移除该额外变量后完整重跑通过，不是产品回归。
- `npm run test:coverage:ci`：通过；statements 66.56%、branches 51.82%、functions 66.67%、lines 67.88%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 未运行 E2E、迁移、`db push`、seed 或任何真实 Zammad/AI provider 请求。

## 第三批验证结果

- FAQ、webhook 与文件存储定向回归：6 个文件、40 个测试通过；补充真实 `NextRequest` body stream、超限 stream 和实际受控目录写入覆盖后，相关定向复跑均通过，最终 webhook 单文件 12 个测试通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：121 个文件、1126 个测试全部通过；statements 66.70%、branches 52.19%、functions 66.64%、lines 68.02%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告，trace 指向 `next.config.js`、`file-storage.ts` 与 avatar route。
- 构建使用不可连接的 PostgreSQL/Zammad 占位地址；未运行 E2E、迁移、`db push`、seed 或任何真实 Zammad/AI provider 请求。

## 下一步

1. 为 env fallback credential、登录组合限流和 dev auto-login 显式开关形成兼容迁移方案后再改生产行为。
2. 确认唯一可信代理、`x-forwarded-for` overwrite 规则与共享限流存储，再处置 AUD-020。
3. 继续按匿名、低权限、高权限顺序清理 AUD-016 的剩余原始异常响应，并用稳定错误契约保护前端兼容性。
4. 在部署产物中验证 uploads 持久卷、symlink 与 NFT trace 行为，并继续核对附件权限缓存、数据/Zammad 事务、幂等与补偿边界。
5. 对 Sharp/Next 漏洞链建立独立兼容性验证，不把 npm 的错误降级建议直接应用到主线。
