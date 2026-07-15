# Zammad 替代调查基线

**调查日期**：2026-07-10

**状态**：只读调查完成；迁移前置条件仍有未满足项

**用途**：作为后续设计、实施计划、迁移核验和多轮对话的共同事实基线

## 1. 结论

当前项目可以逐步替代 Zammad，但不能把它视为一次普通的后端重写。Zammad 同时承担了身份验证、工单、文章、附件、邮件收发、邮件线程和部分自动化规则；现有 Next.js 代码还把多项 Zammad 原始字段作为公开 API 合约。

推荐的长期边界是：

- 保留 Next.js、React、NextAuth、FAQ、AI、通知和现有页面。
- 新增 Go 模块化单体，负责身份、工单、文章、附件、邮件及迁移核验。
- 继续使用 PostgreSQL，不引入 Redis、Kafka、Elasticsearch 或独立工作流引擎。
- 继续使用现有企业邮箱；Go 只实现 IMAP/SMTP 邮件客户端，不建设邮件服务器。
- 保留全部已有 Zammad 数字 ID、工单编号和 zammad-<id> 本地用户 ID。
- 通过现有 Next.js API 保持前端接口、URL 和权限行为不变，再逐项切换内部实现。

“无损迁移”的可证明范围必须明确：

- Zammad 数据库、附件存储和平台 PostgreSQL 中仍存在的数据，应逐项迁移并核验数量、关系和内容哈希。
- 邮箱中仍存在的原始邮件，应按原始字节保存并核验 SHA-256。
- 当前源端已经不存在的历史 raw MIME 无法逆向恢复，只能显式标记为 legacy_raw_unavailable，不能宣称已恢复。
- 未取得 Zammad 数据库备份、application_secret 和用户密码哈希前，不能保证用户原密码无感迁移。

## 2. 调查范围与证据

本次调查使用以下只读来源：

| 来源 | 核验内容 |
|---|---|
| 当前仓库代码 | Zammad 调用面、API 合约、权限、Webhook、邮件旁路、本地数据耦合 |
| 运行中的 Zammad | 版本、数据库与附件规模、工单、文章、附件、状态、分组、邮件投递记录 |
| Zammad REST | 工单文章和附件可读性、附件字节长度、接口行为 |
| 企业邮箱 IMAP/SMTP | TLS 登录、能力、文件夹、UID 水位、原始邮件与 Message-ID |
| 平台 PostgreSQL | 本地表数量、Zammad ID 耦合、分配数据冲突和孤立记录 |

文档不保存凭据、邮箱地址、原始邮件内容、附件名称或非必要服务器地址。

## 3. 当前代码依赖面

代码精确搜索确认：

- 39 个源码文件直接依赖 Zammad。
- 实际使用 33 个 Zammad 客户端方法。
- 共发现 143 个调用表达式。
- 主要范围包括 Ticket、Article、Attachment、User、Group、Out-of-office 和 Trigger。

关键事实：

1. Ticket API 通过展开 Zammad Ticket 原始对象返回数据，原始字段已经成为事实接口合约。
2. Article API 基本透传 Zammad Article，前端依赖文章 ID、类型、发送者、正文、时间和附件字段。
3. 历史 HTML 正文可能包含 Zammad 附件路径，迁移后必须保持旧路径兼容或在展示层转换。
4. 角色 ID、状态 ID、优先级 ID和区域分组 ID存在硬编码。
5. 登录后的本地用户 ID固定为 zammad-<数字ID>，并被 JWT、通知和本地表引用。
6. 工单搜索公开支持部分 Zammad DSL 语义，Go 替代层必须兼容已用字段，或在切换前收窄公开合约。

代表性代码位置：

- src/lib/zammad/client.ts
- src/lib/zammad/types.ts
- src/auth.ts
- src/app/api/tickets/
- src/app/api/webhooks/zammad/route.ts
- src/lib/ticket/
- src/lib/utils/ticket-helpers.ts
- prisma/schema.prisma

## 4. Zammad 运行数据

### 4.1 运行版本与规模

| 项目 | 已核验值 |
|---|---:|
| Zammad | 6.5.2 |
| PostgreSQL | 17.7 |
| Zammad 数据库 | 约 143 MB |
| Zammad 附件存储 | 约 78 MB |
| Redis | 7.4.7 |
| Elasticsearch | 8.19.8 |
| Failed Emails | 0 |

Redis 和 Elasticsearch 是当前 Zammad 运行依赖，不是 Go 替代方案的目标依赖。

### 4.2 业务数据

| 实体 | 已核验数量 |
|---|---:|
| 工单 | 130 |
| 用户 | 164 |
| Active 用户 | 134 |
| Inactive 用户 | 30 |
| 工单文章 | 486 |
| Email 文章 | 405 |
| Web 文章 | 44 |
| Note 文章 | 37 |
| 文章附件 | 273 |

Email 文章发送者分布：

| 发送者 | 数量 |
|---|---:|
| Customer | 117 |
| Agent | 162 |
| System | 126 |

其他已核验事实：

- 405 个 Email Article 全部有 Message-ID。
- 405 个 Email Article 的 In-Reply-To 和 References 在 Zammad Article 中均为空。
- 284 条出站投递记录状态为 success。该状态只代表 Zammad 记录的发送结果，不能证明最终送达。
- 273 个附件的元数据大小合计 47,149,141 字节。
- 102 个附件带 Content-ID。
- 118 个附件是 MIME alternative 内容。
- 当前状态表只存在 ID 1 至 6；现存工单只使用 1、2、4。
- Group 1 至 9 全部 active，全部允许 follow-up。

### 4.3 article_count 语义

Zammad Ticket 的 article_count 不能直接作为文章总数使用。

- 126 个工单满足：实际文章总数 = article_count + 1。
- 它在当前数据中的实际含义接近“首篇之后的回复数”。

迁移核验必须以 Article 实表数量为准，不能用 Ticket.article_count 代替。

## 5. 附件读取核验

| 项目 | 结果 |
|---|---:|
| 附件总数 | 273 |
| 已通过 REST 下载并核验字节长度 | 261 |
| 尚未完成 REST 核验 | 12 |

未完成项的原因是源端传输速度过慢，不代表附件不存在。观测到：

- 最大附件约 7 MB。
- 慢速样本约 20 KB/s。
- 180 秒只能传输约 3.6 MB。
- Zammad 附件接口忽略 HTTP Range，请求返回 200，无法断点续传。

正式迁移应优先使用 Zammad PostgreSQL 备份和附件存储备份；REST 仅作为差异核验通道。迁移前必须从附件存储直接完成剩余 12 项的 SHA-256 核验。

## 6. 邮箱调查

### 6.1 连接和能力

当前活动邮箱为阿里企业邮箱：

| 通道 | 已核验配置 |
|---|---|
| IMAP | TLS，993 |
| SMTP | TLS，465 |

登录探针均成功。

IMAP 能力：

- 支持 IMAP4rev1、IDLE、UIDPLUS。
- 不支持 QRESYNC、CONDSTORE。

SMTP 能力：

- 支持 AUTH、8BITMIME、DSN、PIPELINING。

由于业务量较小，Go 初版应以 UID 定时轮询为主。IDLE 可以后续增加，不能依赖 QRESYNC 或 CONDSTORE。

### 6.2 当前水位和文件夹

| 项目 | 已核验值 |
|---|---:|
| UIDVALIDITY | 2 |
| UIDNEXT | 215 |
| INBOX 实际 UID | 192 至 214 |
| INBOX 实际邮件 | 23 |
| 已发送 | 42 |
| 垃圾邮件 | 2 |
| 已删除邮件 | 0 |
| 草稿 | 0 |

服务端 STATUS 报告 INBOX 为 209 封，但 EXAMINE 和 UID SEARCH 只返回 23 封。Go 客户端必须以 EXAMINE 与 UID SEARCH 的实际结果为准，不能把 STATUS 数量当作处理水位。

### 6.3 历史原始邮件可恢复范围

- INBOX 当前 23 封原始邮件全部能按 Message-ID 匹配到 Zammad Customer Article。
- 时间范围为 2026-06-11 至 2026-07-09。
- Zammad 共有 117 条 Customer Email Article，因此更早的 94 封客户邮件 raw MIME 已不在当前邮箱中。
- 已发送文件夹的 42 个 Message-ID 均无法匹配 Zammad Article，不能作为 Zammad 历史出站邮件原件来源。

结论：历史 Article、Header 字段、正文和附件仍可迁移；94 封历史入站邮件及无法匹配的历史出站邮件不能宣称拥有原始 MIME。对应记录必须标记 legacy_raw_unavailable。

## 7. 平台 PostgreSQL 调查

### 7.1 表数量

| 模型 | 数量 |
|---|---:|
| UserZammadMapping | 0 |
| UploadedFile | 40 |
| TicketRating | 3 |
| TicketUpdate | 7 |
| Notification | 602 |
| AiConversation | 760 |
| AiMessage | 6819 |
| CustomerStaffBinding | 4 |
| ServiceGroup | 10 |
| CustomerGroupAssignment | 35 |

### 7.2 分配数据

- 98 个已有工单的客户中，32 个有当前 CustomerGroupAssignment。
- 66 个没有当前 assignment。
- 4 条 active CustomerStaffBinding 中，2 条与新 assignment 一致，2 条负责人冲突。

迁移后的唯一业务来源应为 ServiceGroup 与 CustomerGroupAssignment。旧 CustomerStaffBinding 只能在逐条核验并保存审计结果后归档，不能直接删除。

### 7.3 孤立和缺失数据

- 3 条 TicketRating 指向当前 Zammad 已不存在的工单。它们属于历史数据，不能因外键不存在而删除。
- PostgreSQL 中有 40 条 UploadedFile 元数据，但当前工作区 uploads 目录没有对应文件。
- 这 40 个文件必须从实际应用服务器或其备份中恢复；当前工作区不能证明文件字节仍存在。

## 8. 身份和密码迁移

Zammad 6.5.2 可以同时保留多种历史密码格式。新式格式可能使用带 application_secret 的 Argon2，旧用户还可能是 {sha2} 或 $argon2i$。本次尚未逐用户统计生产哈希格式；REST API 不返回密码哈希。

无感迁移用户原密码的硬性前置条件：

1. 取得 Zammad PostgreSQL 数据库备份。
2. 取得对应实例的 application_secret。
3. 导出用户密码哈希及认证方式，并逐用户统计实际哈希格式。
4. 只为实例中实际存在的格式实现兼容验证器。
5. 为每种实际格式准备由 Zammad 验证通过的固定测试向量。
6. 对带 secret 的 Argon2 格式使用支持 Argon2 secret 参数的实现。
7. 用户首次在 Go 验证成功后，转换为新系统密码哈希。

Go 标准扩展库的常用 Argon2 接口不提供 secret 参数，不能未经测试直接替代带 secret 的格式。建议对该格式封装官方 libargon2，并在目标部署环境验证构建和运行方式。旧格式仅用于兼容读取，首次成功登录后立即升级，不再生成新的旧格式哈希。

没有数据库备份和 application_secret 时，只能采用密码重置或在 Zammad 存活期间进行渐进式登录迁移；这两种方式都不能保证所有用户原密码在停用 Zammad 后继续有效。

## 9. 已发现的结构性风险

1. Zammad mutation 自动重试没有幂等键，响应丢失时可能重复建单或重复发信。
2. Zammad Webhook 没有事件唯一键，重复请求可能重复创建 TicketUpdate、通知和旁路处理。
3. 前端生成的临时 messageId 被服务端校验移除，实际不具备幂等或邮件线程作用。
4. Trigger 的代码定义与运行实例存在漂移，不能仅根据仓库脚本判断生产行为。
5. 当前欢迎流程会把临时密码写入邮件和工单历史，迁移后必须改为一次性激活链接。
6. 运行中只有新工单自动回复 Trigger 处于 active；follow-up 与 owner-change 邮件处于 inactive。
7. SMTP DATA 后连接中断时无法判断服务端是否接收；直接重发会造成重复邮件。
8. API 返回直接暴露 Zammad 原始字段，替代实现不能只迁移最小业务字段。
9. 状态 6/7 在当前代码常量和统计逻辑中存在不一致，迁移前必须以运行数据和兼容测试确定行为。

## 10. 迁移不变量

任何实施方案必须同时满足：

- 用户、工单、文章和外部可见附件引用保持原有数字 ID。
- 工单 number 保持不变，新编号不得与历史编号冲突。
- zammad-<id> 本地用户 ID、现有 JWT 身份和本地外键语义保持兼容。
- 现有 Next.js API 路径、权限结果和前端依赖字段在切换时保持兼容。
- 每个附件迁移后必须有原始大小和 SHA-256；Content-ID、disposition、content type 和顺序必须保留。
- 每个历史 Email Article 必须保留 Message-ID、地址字段、subject、正文、类型、发送者、internal 标记和时间。
- 无法恢复的 raw MIME 必须明确标记，不得生成伪造内容。
- 调查日的 130 个工单、273 个附件和 40 条 UploadedFile 只是快照，最终验收必须使用写冻结后的动态主键清单和哈希，不能把这些数字写死为生产完成条件。
- 每次迁移必须有 run ID、源水位、数量、哈希、异常清单和完成时间；幂等键必须包含源系统、源实体类型和源 ID。
- 入站邮件必须先持久化 raw MIME 和哈希，再推进 IMAP 水位。
- IMAP 水位和 source key 必须按邮箱账户与文件夹隔离，并包含 UIDVALIDITY 和 UID。
- 任何时刻只能有一条权威入站处理链路和一条权威出站发送链路；链路内部可以有多个 Worker，但单封邮件或单次投递必须被独占处理。
- 已进入 SMTP uncertain 状态的邮件禁止自动重发。

## 11. 切换前仍需完成的调查

以下项目是生产切换硬门槛，不属于可忽略风险：

| 项目 | 当前状态 | 完成标准 |
|---|---|---|
| Zammad PostgreSQL 备份 | 未取得可验证副本 | 完成恢复演练并导出密码哈希 |
| 平台 PostgreSQL 备份 | 未取得可验证副本 | 完成恢复演练并生成最终动态主键与哈希清单 |
| application_secret | 未取得 | 与数据库备份属于同一实例 |
| Zammad 附件存储备份 | 未取得可验证副本 | 写冻结后的最终动态附件清单全部完成 SHA-256 |
| 12 个已知慢速附件 | REST 未完成 | 作为当前异常清单，从存储备份直接核验；最终以动态清单为准 |
| 40 个已知 UploadedFile 字节 | 当前工作区缺失 | 作为当前异常清单，从应用服务器恢复并核验；最终以动态清单为准 |
| Mail channel 完整导出 | 部分已核验 | 保存账号配置、签名、别名、分组映射和 follow-up 规则，不含凭据 |
| Trigger 与发送队列 | 运行状态已抽样 | 切换前再次导出并确认队列为空 |
| 身份认证与哈希格式 | 尚未逐用户分类 | 明确认证方式，统计 {sha2}、$argon2i$ 和带 secret Argon2 等实际格式，并逐格式通过测试向量 |
| 回切演练 | 未执行 | 在恢复环境完成一次完整演练 |

各备份还必须来自同一个应用一致性时点：暂停写入并等待在途事务完成后，同时记录 Zammad PostgreSQL 与平台 PostgreSQL 的快照位置，并生成 Zammad 附件存储和 UploadedFile 字节的完整清单。来自不同时间点的数据库与文件备份不能作为无损迁移证据。

## 12. 后续更新规则

- 后续调查只追加带日期和证据来源的结论。
- 新结论与本文件冲突时，先保留原结论并说明差异原因，再更新状态。
- 运行数据变化不应直接覆盖本次快照；应新增新的调查基线或明确“复核日期”。
- 实施计划必须引用本文件中的硬门槛和迁移不变量。
