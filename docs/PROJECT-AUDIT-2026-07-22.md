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

### AUD-015：非 production 环境无条件启用固定 mock 管理员凭据（P2，待加固）

证据：

- `isMockAuthEnabled()` 对所有 `NODE_ENV !== 'production'` 直接返回 `true`，不读取 `NEXT_PUBLIC_ENABLE_MOCK_AUTH`；因此该变量当前不能在 staging / demo 中关闭 mock credentials。
- Zammad 认证失败后，标准 NextAuth Credentials 流程会继续匹配 `mockUsers` / `mockPasswords`，其中包括固定的 `admin@test.com` / `password123`，成功后会签发正常 JWT session。
- middleware 对所有 `/api/dev/*` 在非 production 环境直接放行。
- `/api/dev/auto-login` 只检查 `NODE_ENV !== 'production'`，随后允许调用者选择 customer、staff 或 admin，并返回 mock session。
- 精确搜索没有发现 auto-login API 的应用内调用方；其服务端 `mockSignIn()` 不会写浏览器 cookie，因此它不是主要提权路径，标准 Credentials mock login 才是实际认证边界。
- mock credentials 和 dev route 都不要求独立的 server-side enable flag。

影响与结论：

- 正式 production build 被 middleware 和 route 双重阻止；当前没有生产直达证据。
- 若 staging、演示或临时环境以非 production 模式对外暴露，知道仓库固定凭据的匿名用户可通过正常登录流程取得管理员 session。
- 应增加默认关闭的 server-side 开关，并同时约束 mock Credentials、`/api/dev/*` middleware/authorized 放行和 auto-login route；测试环境可显式开启，staging 必须保持关闭。`NODE_ENV` 和 `NEXT_PUBLIC_*` 变量都不应单独承担该安全边界。

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

## 第三阶段：数据与 Zammad 边界

### AUD-021：Zammad client 会自动重放写请求，并错误重试 4xx（P1，已修复）

证据：

- 通用 `request()` 修复前把 fetch、HTTP status 处理和 JSON 解析都包在同一个 catch 中；4xx 分支抛出的错误也会进入“network error”重试逻辑。
- 现有“4xx 不重试”测试使用 `maxRetries=0`，没有验证生产默认 `maxRetries=1`，因此无法发现该行为。
- `createTicket`、`createArticle`、`createUser`、`updateTicket`、tag 等写方法共用同一重试逻辑；5xx、超时或连接中断时都会自动重放 POST/PUT/DELETE。
- 对写请求而言，连接异常只说明客户端没有拿到响应，不能证明 Zammad 没有完成操作；自动重放可能重复创建工单、回复或用户，并重复触发通知/webhook。

修复：

- 仅 GET/HEAD 在网络错误或 5xx 时进行指数退避重试；写请求单次执行，把未知结果交给调用层的幂等键、查询确认或补偿流程处理。
- HTTP status 处理移出 fetch catch，4xx 不再被误判为网络异常。
- 同时兼容 `AbortError` / `TimeoutError`，并允许 DELETE 等接口正常返回空 204。
- 新增默认非零重试配置下的 4xx、POST 5xx、POST network error、GET network recovery 和 204 回归测试。

### AUD-022：reopen 的 note 失败会留下已打开工单却返回 500（P1，已修复）

证据：

- reopen route 先调用 `updateTicket(..., { state: 'open' })`，再创建内部 note。
- 修复前 note 创建失败会直接进入最外层 catch 并返回 500，不恢复原始 closed 状态；客户端看到失败，但 Zammad 中工单已经打开。
- 该不一致会误导重试、隐藏真实状态，也让预期的 reopen 审计 note 缺失。

修复：

- note 创建失败时 best-effort 把状态恢复为 `closed`；回滚自身失败会记录 ticket ID 和服务端错误。
- 新增回归测试，验证第一次 update 打开、article 失败、第二次 update 恢复 closed，最终维持原有 500 契约。

### AUD-023：批量工单迁移的回滚在首个失败处停止（P1，已修复）

证据：

- `rollbackTicketMigration()` 修复前按逆序串行恢复 snapshot，但没有逐项 catch；任一恢复失败后，剩余更早的已迁移工单不会再尝试回滚。
- 多个 service-group route 把该异常作为 best-effort 直接吞掉，修复前服务层也不记录具体失败 ticket，残留状态难以发现和人工修复。
- 内部迁移 catch 直接 `await rollback; throw original`，一旦 rollback 抛错，原始迁移错误也会被替换。

修复：

- 回滚现在始终尝试全部 snapshot，逐项记录失败 ticket，最后用 `AggregateError` 汇总。
- 迁移错误与不完整回滚会组合保留；回滚全部成功时仍抛原始迁移错误，兼容现有错误路径。
- 新增回归测试，验证逆序第一个回滚失败后仍继续恢复剩余工单。

### AUD-024：SSE 正常连接时关闭了跨实例 polling 备援（P1，已修复）

证据：

- `SSEEmitter` 明确是进程内 `Map`，源码也注明水平扩容需要 Redis 等共享 pub/sub；webhook 只能向命中同一应用实例的订阅者广播。
- 修复前 `TicketUpdatesProvider` 只在 `!sseConnected || sseFailed` 时启用 polling。客户端即使与实例 B 保持健康 SSE，命中实例 A 的 webhook 也不会到达该连接，而“健康”状态又会关闭持久化 `TicketUpdate` 查询。
- provider 注释声称 SSE 连接时仍有较慢 polling 备援，但实际条件与注释相反。

修复：

- ticket 页面现在始终保留现有 polling hook；SSE 继续提供低延迟推送，30 秒 polling 负责跨实例与漏推恢复。
- SSE 与 polling 返回同一 `TicketUpdate.id` 时仍由既有 processed-ID 集合去重。
- 新增组件回归测试，验证 SSE 连接成功后 polling 仍保持启用。

### AUD-025：TicketUpdate 时间戳游标和 100 条全局上限会永久跳过更新（P1，待修复）

证据：

- updates API 查询 `createdAt > since`，按 `createdAt desc` 取全局前 100 条，之后才按当前用户的 metadata 权限过滤。
- 查询完成后才用新的 `Date.now()` 作为 `serverTime`；客户端无条件把该值持久化为下一次 `since`。
- 因此存在两个确定的丢失窗口：查询快照之后、`serverTime` 生成之前写入的记录不会出现在本次结果中，但时间又早于下一游标；一个窗口内超过 100 条时，较旧记录被截断后客户端仍直接跳到窗口末尾。
- 因权限过滤发生在 `take: 100` 之后，其他用户不可见的高流量也能占满这 100 条并挤掉当前用户的可见更新。
- 当前游标只有毫秒时间戳，没有 `(createdAt, id)` tie-breaker 或 `hasMore` 分页协议。

影响与结论：

- AUD-024 恢复了跨实例 polling，但不能补回被当前游标协议永久跳过的记录；前端可能不刷新、漏 toast 或漏未读计数，直到用户执行其他刷新动作。
- 应改为稳定复合游标、升序分页和明确的 high-water mark / `hasMore` 协议，并覆盖同毫秒记录、超过 100 条、查询期间并发写入和权限过滤后的分页测试。该修改涉及前后端持久化游标兼容，不在本批局部修改中仓促实施。

### AUD-026：出站 Zammad 写入没有稳定 intent / 幂等或 unknown-outcome 对账（P1，待架构决策）

证据：

- Zammad client 已停止自动重放 POST/PUT/DELETE，但请求头只有认证、content type、accept 和可选 `X-On-Behalf-Of`；没有稳定业务 intent ID。
- Prisma schema 没有 Zammad write intent、outbox、recovery ledger 或请求结果对账模型；精确搜索只找到 AI 消息自身的幂等保护，没有覆盖 `createTicket`、`createArticle`、`createUser`。
- 工单、回复和用户创建 route 都直接调用对应 Zammad create API。网络超时只证明本应用没有拿到响应，不能证明 Zammad 没有提交；调用者重新提交仍可能重复创建。
- 迁移服务在 `await updateTicket()` 返回后才把 ticket 放入 snapshot。若更新已在 Zammad 成功但响应丢失，该 ticket 不会进入当前补偿列表。

影响与结论：

- AUD-021 消除了客户端自身的自动重复写，但没有解决人工/前端重试或补偿流程面对 unknown outcome 的重复与遗漏风险。
- 需要先确认 Zammad 可用的外部标识、自定义字段或查询语义，再选择本地持久化 intent/outbox、稳定 idempotency key、写后对账和 operator-visible recovery 状态；不能仅靠再次 POST 或盲目回滚。

### AUD-027：email user welcome 的 note marker 不是并发 claim（P1，待架构决策）

证据：

- welcome flow 先读取 Zammad user note、检查历史 article，再生成随机密码并调用 `updateUser({ password, note })`；整个 read-check-write 没有数据库唯一约束、条件更新或共享锁。
- 两个并发 created-ticket webhook 可同时观察到空 note，分别生成密码 A/B，并先后覆盖同一用户密码。
- 两个流程随后都可创建 welcome email article；其中一封可能包含已被另一个流程覆盖的旧密码。发送成功后追加 `WelcomeEmailSent` marker 也不是条件写，不能反向保证邮件中的密码仍有效。
- article 扫描只能发现已经可见的历史邮件，不能阻止两个都已通过检查的并发流程继续发送。

影响与结论：

- 这不仅是重复邮件问题，还可能把无效凭据发给客户并造成账号登录故障。
- 需要持久化、原子的 per-user welcome claim/workflow 状态，并把密码设置、发送结果与可恢复状态关联起来；进程内锁无法覆盖多实例或重启，不作为正式修复。

### AUD-028：webhook 把高延迟副作用标成 non-blocking，但实际在响应前逐项 await（P1，待架构决策）

证据：

- webhook 在返回 200 前等待用户映射、`TicketUpdate` 写入、SSE recipient 解析和通知创建；通知 recipient 循环也是串行 await。
- created 事件随后依次 await email routing 和 email user welcome，源码注释却写为 “Non-blocking”。
- routing 可读取客户、分组、负责人、全量 admin 用户并执行多次 Zammad 写；welcome 为恢复 marker 会分页检索该客户全部工单，并逐工单读取 articles。
- welcome 函数注释称其“异步调用且不应阻塞 webhook response”，与 route 实际调用方式冲突。

影响与结论：

- 大客户历史或慢 Zammad 会直接拉长 webhook 响应；上游超时重投会放大 AUD-027/AUD-029 的并发和重复副作用。
- 不能简单改为未等待的 Promise：serverless/容器请求结束后任务可能被终止。应先持久化已验签事件或 job/outbox，快速确认接收，再由有 lease、重试和 dead-letter/recovery 状态的 worker 执行副作用。

### AUD-029：webhook 与通知去重缺少数据库唯一边界（P1，待修复）

证据：

- `TicketUpdate` 只有随机 CUID、ticket/event/data/createdAt 和普通索引，没有上游 event/article ID 唯一约束；重复 webhook 会创建新的本地 ID 并再次广播，前端按本地 ID 去重无法识别同一上游事件。
- created/article event 虽把 `articleId` 放在 JSON data 中，但没有可查询的结构化唯一列；status/assignment 事件也没有稳定 source event ID。
- `NotificationService.create()` 采用“先 `findFirst`、再 `create`”的 5 分钟窗口去重，schema 没有对应 unique key；并发请求可同时查不到记录并各自插入。
- created webhook 还会再次触发 routing 和 welcome，因此重复影响不止 UI 通知。

影响与结论：

- 需要定义可复现的 webhook source key；能使用 article ID 的事件应数据库唯一化，状态类事件需要结合 Zammad 提供的事件标识或经过验证的 canonical fingerprint/version。通知去重也应以数据库约束或事务 claim 为准。

### AUD-030：跨 Prisma/Zammad 补偿失败没有持久化恢复账本（P1，待架构决策）

证据：

- service-group 管理 route 在本地 assignment/update 失败后调用 `rollbackTicketMigration()`，但多处 catch 直接吞掉 rollback 的 `AggregateError`；其他本地 assignment 恢复失败也只有 “Best-effort rollback” 空 catch。
- migration service 现在会记录每个 Zammad ticket rollback 失败，这是改进，但日志不是可查询、可认领、可关闭的恢复任务，route 也不会把不完整补偿状态返回给 operator。
- Prisma 与 Zammad 不可能共享数据库事务，当前 schema 又没有 operation/recovery record 保存原始 snapshot、已完成步骤、失败 ticket 和重试状态。

影响与结论：

- 管理员可能只看到原操作失败，却不知道部分工单或本地 assignment 已经改变；日志丢失、轮转或多实例分散后难以可靠修复。
- 需要 durable operation/recovery ledger、明确的 `needs_reconciliation` 状态和管理员可见的重试/人工处置流程。继续增加 best-effort catch 不能建立跨系统原子性。

### AUD-031：service-group cutover 开关默认关闭且未进入部署文档，旧 binding 与当前真相并存（P2，待兼容决策）

证据：

- `isServiceGroupAssignmentCutoverActive()` 只有环境变量严格等于 `true` 才生效；变量未出现在 `.env.example`、部署说明或现行架构文档中。
- flag 未开启时，旧 `/api/admin/customer-bindings` POST/DELETE/transfer 仍可修改 `CustomerStaffBinding`。
- 当前 customer ticket 创建、email routing、单票 auto-assign 和批量 auto-assign 已读取 `CustomerGroupAssignment/ServiceGroup`，不读取 legacy binding；旧 binding mutation 因而可能成功返回却不影响这些主路径。
- `docs/ARCHITECTURE.md` 和 `docs/ZAMMAD-INTEGRATION.md` 仍把 customer-staff binding 描述为当前分配核心，与代码已经漂移。
- 不能直接全局翻转开关：当前实现还会在 cutover active 时禁用 batch auto-assignment，需要先确认这是迁移期冻结还是长期行为。

影响与结论：

- 应先盘点生产 legacy binding 与 service-group assignment 数据，确定一次性迁移/冻结/回滚步骤，再把开关语义、默认值和部署验证写入运维文档，并更新架构事实。未在缺少生产数据与兼容决策时擅自改变默认行为。

### AUD-032：通知 retention 与 unread count/cleanup 口径不一致（P2，已修复）

证据：

- 通知列表只查询最近 30 天，但 `unreadCount` 和独立 unread-count API 修复前统计该用户全部未读行；旧未读通知会从列表消失，却继续出现在 badge 中。
- 列表查询也不排除已经到达 `expiresAt` 的行，是否仍显示取决于 lazy cleanup 是否恰好运行。
- webhook cleanup 和 `NotificationService.cleanupExpired()` 修复前都只删除显式 `expiresAt` 已过期的行；绝大多数 ticket notification 没有设置 `expiresAt`，因此即使超过列表 retention 也不会删除，表会持续增长。

修复：

- list、total 和 unread count 统一使用“最近 30 天且未显式过期”的 active notification 条件。
- cleanup 同时删除显式过期行和超过 retention 的行，webhook lazy cleanup 复用同一 service 语义。
- 新增单测验证列表/count 查询条件以及显式过期、retention 过期的双重清理。

### AUD-033：webhook 类型声明有显式 event，但运行时完全依赖时间启发式（P1，待隔离 payload 验证）

证据：

- `src/lib/zammad/types.ts` 与 `src/types/api.types.ts` 的 `ZammadWebhookPayload` 都要求 `event: ticket.create | ticket.update | ticket.close | ticket.escalation`，但 route 从不读取 `webhookPayload.event`。
- 有 article 时，仅凭 ticket/article `created_at` 相差小于 5 秒判定 `created`；否则判定 `article_created`。
- 没有 article 时，仅凭 `updated_at` 与 `last_owner_update_at` 相差小于 5 秒判定 `assigned`；否则统一判定 `status_changed`，没有比较前后 owner/state 值。
- 当前测试 fixture 多数通过 `any` 省略 `event`，因此无法证明类型契约与实际 Zammad webhook template 一致。

影响与结论：

- 创建后 5 秒内的第二篇 article 可被误当成 created 并再次触发 routing/welcome；owner 变更附近的其他字段更新可被误当成 assigned；不带 article 的 create payload 也会落为 status change。
- 先在完全隔离的 Zammad 测试环境保存各 trigger 的实际签名 payload 与重投样本，再决定使用显式 event、trigger-specific endpoint，还是带稳定 source ID/version 的规范化 envelope。未在没有真实 payload 证据时按过期 TypeScript 声明直接改生产分支。

### AUD-034：TicketUpdate/Notification retention 依赖 webhook 内 fire-and-forget 清理（P2，待运维修复）

证据：

- `maybeRunCleanup()` 只从 webhook route 调用，使用进程内 `lastCleanupAt`，并在请求返回前以 `void runCleanup()` 启动未等待任务。
- serverless 或容器请求结束后不保证该 Promise 完成；失败后本实例仍会因为提前更新 `lastCleanupAt` 而等待一小时才重试。
- 多实例各自拥有独立时间戳，可能重复执行；没有数据库 lease/advisory lock，也没有 scheduler/cron 配置或成功时间监控。
- notification retention 查询口径已由 AUD-032 修复，但物理删除和 7 天 `TicketUpdate` retention 仍依赖这个 best-effort 入口。

影响与结论：

- 应迁移到显式 scheduler/worker，并用数据库 lease 或 advisory lock 保证单次执行；记录 last success、deleted counts 和 failure 告警。请求内 cleanup 只能作为临时优化，不能作为 retention 保证。

### AUD-035：本地 Playwright 会复用任意 3010 server，缺少写测试显式隔离门槛（P1，已修复）

证据：

- E2E 包含创建工单、回复、附件和管理 mutation；`npm run test:e2e` 修复前不要求任何 opt-in。
- Playwright 在非 CI 环境设置 `reuseExistingServer: true`。若开发者已经启动一个读取共享/生产 `.env.local` 的 server，E2E 会直接附着到该进程，Playwright 自身的 shell 环境变量无法约束 server 已加载的凭据。
- CI job 有仓库级开关和不可连接 Zammad，但这个保护不覆盖本地直接执行或 `npm run test:all`。

修复：

- Playwright 配置加载时强制要求 `RUN_ISOLATED_E2E=true`、数据库名包含 `test`、以及有效 `DATABASE_URL`/`ZAMMAD_URL`。
- 默认只允许 loopback PostgreSQL 与 Zammad；专用远程测试系统必须再显式设置 `ALLOW_REMOTE_E2E_SERVICES=true`。
- 禁止复用已经运行的本地 server；端口被占用时失败，而不是冒险附着。
- gated CI E2E job 显式设置 opt-in。新增 5 个单测，并通过 `playwright test --list` 验证 12 个文件、130 个用例可被安全枚举；未实际执行 E2E。

### AUD-036：现有 E2E 数量很多，但关键流程可条件空跑且与当前路由漂移（P2，待重写）

证据：

- CI E2E 即使开启，Zammad 仍固定指向不可连接的 `127.0.0.1:65535`，也没有 Zammad mock/fixture server；依赖工单写入和读取的真实旅程无法成立。
- `customer-flows-extended.spec.ts` 访问已经不存在的 `/customer/tickets`，创建工单用例只有在按钮/输入可见时才填写，最后仅断言 URL 仍含 `/customer`，没有提交或验证创建结果。
- ticket detail 用例在没有工单时直接记录日志后通过，reply 用例在没有 ticket/reply area 时也无断言。
- 多个“跨角色完整流程”只验证两个页面能打开，没有建立 customer 创建的数据被 staff 看见、处理并由 customer 再读取的确定 fixture。

影响与结论：

- 130 个枚举用例不能等同于 130 个有效业务断言；当前 E2E 更接近可选 smoke 集合，不能作为发布关键工单链路的证据。
- 应先拆成不依赖 Zammad 的 UI/auth smoke 与需要隔离 Zammad fixture 的真实 contract journey；禁止用条件分支静默通过，缺 fixture 应显式 `skip`/失败并在报告中可见。完成前继续保持 CI E2E 默认关闭。

### AUD-037：mock API 测试仍偷偷访问 Prisma，并把缺失 mock 当预期日志吞掉（P2，已修复）

证据：

- 完整 Vitest 中 `tickets.test.ts` 每个 list case 都真实调用 `prisma.ticketRating.findMany()`，只因 route 的 best-effort catch 才继续通过；使用不可连接占位地址时每次等待约 2 秒并打印连接失败。
- `ai.test.ts` 的正常 chat case 真实调用 `getConversation()`，同样依赖捕获 Prisma 连接错误后退化为 proxy。
- `tickets-rating.test.ts` 没有 notification/user-mapping mock，成功 rating case会记录 “Failed to send notification”，测试仍然通过。

修复：

- 为三组 route 测试补齐 Prisma、AI conversation 和 notification 边界 mock。
- 定向 48 个测试从多次 2 秒连接等待降为毫秒级执行；正常成功 case 不再产生数据库连接或缺失 notification mock 错误。
- 真实数据库行为仍只由显式 opt-in 的 database integration suite 承担，普通 API 测试不再把“连接失败且被吞掉”误当隔离方式。

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
npm run test -- __tests__/unit/zammad-client.test.ts
npm run test -- __tests__/components/ticket-updates-provider.test.tsx __tests__/api/tickets-updates.test.ts __tests__/lib/sse-emitter.test.ts
npm run test -- __tests__/unit/notification-service.test.ts __tests__/api/notifications.test.ts __tests__/api/webhooks-zammad.test.ts
npm run test -- __tests__/unit/e2e-safety.test.ts
npm run test -- __tests__/api/tickets.test.ts __tests__/api/ai.test.ts __tests__/api/tickets-rating.test.ts
npx playwright test --list
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

## 第四批验证结果

- Zammad client 定向回归：1 个文件、42 个测试通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：121 个文件、1130 个测试全部通过；statements 66.71%、branches 52.26%、functions 66.64%、lines 68.04%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 所有 Zammad 行为只通过 MSW mock 验证；未连接真实 Zammad、数据库或 AI provider。

## 第五批验证结果

- reopen 与 ticket migration 定向回归：2 个文件、14 个测试通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：121 个文件、1132 个测试全部通过；statements 66.79%、branches 52.28%、functions 66.72%、lines 68.12%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 多步 Zammad 操作仅通过 mock 验证；未执行真实 reopen、迁移或回滚。

## 第六批验证结果

- SSE/polling 定向回归：3 个文件、4 个测试通过；覆盖 SSE 连接成功后仍保留 polling 备援。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：122 个文件、1133 个测试全部通过；statements 66.68%、branches 52.12%、functions 66.32%、lines 68.01%。
- 第一次完整覆盖率命令人为设置了测试环境 webhook secret，两个未带签名的 orchestration fixture 按代码返回 401；移除该额外变量后完整重跑通过，不是产品回归。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 全部验证使用不可连接 PostgreSQL/Zammad 占位地址；未运行 E2E、迁移、`db push`、seed 或真实外部服务写入。

## 第七批验证结果

- notification retention 定向回归：3 个文件、23 个测试通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：122 个文件、1135 个测试全部通过；statements 66.72%、branches 52.14%、functions 66.42%、lines 68.05%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 全部数据库行为通过 mock 或不可连接占位地址验证；未执行真实 notification cleanup、迁移或外部服务请求。

## 第八批验证结果

- E2E safety guard：5 个单测通过；`playwright test --list` 在安全占位环境下成功枚举 12 个文件、130 个用例，未启动 server 或执行浏览器测试。
- GitHub Actions workflow YAML 解析通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run type-check`：通过。
- `npm run test:coverage:ci`：123 个文件、1140 个测试全部通过；statements 66.77%、branches 52.21%、functions 66.49%、lines 68.10%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告。
- 未执行 E2E、`db push`、迁移、seed、真实 Zammad 或浏览器写流程。

## 第九批验证结果

- API mock 隔离定向回归：3 个文件、48 个测试通过；补齐 Prisma、AI conversation 与 notification 边界 mock 后，不再出现真实 Prisma 连接等待或成功路径 notification warning。
- `npm run type-check`：通过。
- `npm run lint`：通过，0 error / 18 个既有 warning。
- `npm run test:coverage:ci`：123 个文件、1140 个测试全部通过；statements 66.77%、branches 52.21%、functions 66.42%、lines 68.10%。
- `npm run i18n:validate`：通过。
- 隔离生产构建：通过；仍只有 AUD-008 所述的 1 个 NFT 文件追踪警告，trace 指向 `next.config.js`、`file-storage.ts` 与 avatar route。
- 全部验证使用不可连接 PostgreSQL/Zammad 占位地址；未执行 E2E、`db push`、迁移、seed、真实 Zammad、AI provider 或浏览器写流程。

## 下一步

1. 优先设计 AUD-025 的稳定复合游标/分页协议，以及 AUD-026/AUD-029 的 source intent 与数据库唯一边界。
2. 把 AUD-027/AUD-028 的 welcome flow 移入有持久 claim、lease 和恢复状态的异步处理链路，避免请求内 fire-and-forget。
3. 为 AUD-030 建立 operator-visible recovery ledger，并在生产数据盘点后决定 AUD-031 的 legacy binding cutover 步骤。
4. 为 env fallback credential、登录组合限流，以及固定 mock credentials / dev route 显式开关形成兼容迁移方案后再改生产行为。
5. 确认唯一可信代理、`x-forwarded-for` overwrite 规则与共享限流存储，再处置 AUD-020。
6. 继续按匿名、低权限、高权限顺序清理 AUD-016 的剩余原始异常响应，并用稳定错误契约保护前端兼容性。
7. 在部署产物中验证 uploads 持久卷、symlink 与 NFT trace 行为，并对 Sharp/Next 漏洞链建立独立兼容性验证。
