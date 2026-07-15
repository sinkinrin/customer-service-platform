# Zammad 替代与 Go 邮件客户端设计

**日期**：2026-07-10

**状态**：架构方向已确认，书面规格待审阅

**事实基线**：docs/investigations/2026-07-10-zammad-replacement-baseline.md

## 1. 目标

在不改变现有页面、用户身份、工单编号、历史链接和主要 API 行为的前提下，以 Go 模块化单体逐步替代 Zammad 的以下能力：

- 用户身份与密码验证
- 工单、文章、状态、优先级、分组和负责人
- 工单附件
- 企业邮箱 IMAP 收取和 SMTP 发送
- 邮件 MIME、线程、附件、投递状态与迁移审计

成功标准不是“删除 Zammad 进程”，而是：

1. 已存在数据均在可证明范围内完整迁移。
2. 前端和现有本地功能不需要一次性重写。
3. 切换点前后不存在重复建单、错误串单、系统自动重复发信或静默丢信；uncertain 和人工批准重试全部显式披露。
4. 每一项不可恢复的历史数据都有明确记录。
5. Zammad 的数据库和附件快照在观察期保持不可变，直至验收完成。

本设计中的“无缝衔接”指用户 ID、工单编号、链接、API 和历史数据连续，不代表跨多个外部系统实现零秒切换。为防止双写和重复发信，生产切换允许一次短暂、可审计的写暂停；读取由已通过影子验收的 Go 只读快照承接。

## 2. 范围边界

### 2.1 保留

- Next.js 16 和 React 19 页面。
- NextAuth JWT Session。
- 现有 /api/tickets、/api/user、附件代理和前端调用方式。
- Prisma 管理的 FAQ、通知、评分、AI 对话、回复模板和分配模型。
- 现有阿里企业邮箱和域名。
- SSE 与轮询前端体验。

### 2.2 新建

- 单个 Go 服务。
- Go 管理的 PostgreSQL 业务表和迁移表。
- BlobStore 抽象及生产对象存储实现。
- IMAP 收取、MIME 解析、SMTP 发送和邮件状态机。
- Zammad 数据导入、增量同步、核验和异常报告工具。

### 2.3 不做

- 不自建 SMTP/MX 邮件服务器。
- 不引入 Kafka、Redis、Elasticsearch、Temporal 或微服务集群。
- 不重写前端。
- 不在第一阶段重写 FAQ、AI 和通知。
- 不实现可任意组合的 Zammad Trigger DSL；只实现当前明确需要的领域策略。
- 不伪造无法恢复的历史 raw MIME。

## 3. 总体架构

采用“Next.js 稳定边界 + Go 模块化单体”的结构：

| 层 | 职责 |
|---|---|
| 浏览器 | 保持现有页面、请求和附件 URL |
| Next.js BFF | 保持认证、请求校验、前端 DTO 和兼容路由 |
| Backend Adapter | 在 Zammad Adapter 与 Go Adapter 之间切换，支持影子比较 |
| Go Core | identity、ticket、article、attachment、mail、migration、outbox |
| PostgreSQL | 业务数据、邮件状态、迁移审计和任务租约 |
| BlobStore | 原始 MIME 和附件字节 |
| 企业邮箱 | IMAP/SMTP 服务 |

Go 服务先作为内部上游接入，不直接要求前端改 URL。现有 39 个 Zammad 依赖文件应逐步改为使用小型 Backend 接口；切换开关只存在于统一适配层，避免各路由分别判断。

Go 与 Prisma 可以使用同一 PostgreSQL 实例，但应使用独立 schema 和独立 migration history。Next.js 不直接写 Go 业务表；跨边界通过内部 API 和带唯一事件 ID 的 domain event 交互。

## 4. 模块边界

### 4.1 identity

负责：

- 用户资料、角色、组权限、active/verified 状态。
- 兼容 Zammad 数字用户 ID。
- Zammad 实际密码格式的兼容验证器注册表和首次登录重哈希。
- 一次性激活链接。
- out-of-office 四元组及替代人员。

不负责：

- NextAuth Session 格式。
- 页面权限展示。
- 邮件 SMTP 发送。

### 4.2 ticket

负责：

- Ticket、Article、状态、优先级、分组、owner。
- 权限判断所需的稳定字段。
- 工单编号生成。
- 搜索、排序和分页。
- 客户回复、Staff 回复、重新打开和分配行为。

工单模块发出明确领域事件，例如 ticket.created、article.created、ticket.assigned、ticket.state_changed。它不直接发送邮件，也不直接创建 Next.js Notification。

### 4.3 attachment

负责：

- Blob 元数据、内容哈希、大小、MIME 类型和访问授权。
- Zammad 历史附件三元定位兼容。
- Content-ID、disposition、alternative 和 ordinal。
- 现有附件代理 URL 的兼容读取。

BlobStore 接口至少包含 Put、Open、Stat、Delete。生产实现使用对象存储；本地开发可以使用文件目录。数据库只保存元数据和 blob key，不保存大对象字节。

### 4.4 mail

负责：

- IMAP UID 轮询和 checkpoint。
- raw MIME 保全。
- MIME 解析和构造。
- 邮件线程匹配。
- 入站分类、业务应用和防循环。
- SMTP outbox、重试、uncertain、退信和 suppression。

Mail adapter 不理解工单分配规则；它通过 TicketMailPort 请求工单模块解析或创建 thread。

### 4.5 migration

负责：

- 从 Zammad PostgreSQL 备份、附件存储和 REST 差异通道读取数据。
- 从平台 PostgreSQL 读取关联数据并生成异常报告。
- 保存 migration run、source checkpoint、item result、hash 和 anomaly。
- 重复执行时按源主键幂等更新，不创建重复实体。

### 4.6 domain outbox

负责：

- 在业务事务中保存唯一领域事件。
- 重试投递到现有 Next.js 内部事件入口。
- 由 Next.js 幂等生成 TicketUpdate、Notification 和 SSE 更新。

每个事件必须有稳定 event_id。Next.js 处理记录必须对 event_id 建唯一约束，替代当前无去重的 Zammad Webhook 行为。

## 5. 兼容策略

### 5.1 ID 和编号

- User、Ticket、Article 沿用 Zammad 数字 ID。
- 历史附件通过 ticket_id、article_id、attachment_id 保持定位。
- 本地认证 ID 继续使用 zammad-<user_id>。
- Ticket number 原样导入。
- 新记录的数据库 sequence 在导入后设置到历史最大值之后。
- 新工单编号生成器必须读取历史最大编号并通过数据库唯一约束串行化。

不采用“全部换 UUID，再维护映射”的方案。内部允许为邮件 ingest 或 migration run 使用 UUID，但对外业务实体继续使用历史数字 ID。

### 5.2 API

切换期间由 Next.js 保持：

- 现有 API 路径和 JSON 包装。
- 已使用的 Ticket、Article、User、Attachment 字段。
- Customer、Staff、Admin 的资源级权限结果。
- 现有分页、排序和常用搜索字段。
- 旧附件访问 URL。

Go 模型应显式保存已使用字段。暂时无法立即建模但属于事实返回合约的字段，导入时保存在只读 legacy_attributes JSONB 中；它不能替代核心字段建模，也不能保存凭据。

### 5.3 状态、角色和分组

- Role ID 1、2、3 保持 Admin、Agent、Customer 语义。
- Priority ID 1、2、3 保持 low、normal、high。
- 运行数据中的 State ID 1 至 6 原样保留。
- Group ID 1 至 9 原样保留。
- 代码中 State 6/7 的冲突必须在兼容测试中显式处理，不允许通过默认值隐藏。

## 6. 数据模型

以下是逻辑模型，字段名可在实施计划中细化。

### 6.1 工单与身份

- users
- user_credentials
- user_roles
- user_group_permissions
- user_out_of_office
- groups
- tickets
- ticket_articles
- article_attachments
- blobs

每个迁移实体保存 source_system、source_entity_type、source_id、source_updated_at 和 migration_run_id。核心外键必须核验；历史孤立本地记录保留 legacy reference 和 anomaly，不得删除。

### 6.2 邮件

#### mail_accounts

保存邮箱地址标识、transport 类型、From 名称、Reply-To 配置和启用状态。密码或 token 只存在于环境变量或 secret manager。

#### mail_checkpoints

按 account_id 与 mailbox_folder 保存 UIDVALIDITY、last_uid 和复核时间。同一账户的不同文件夹不能共用 checkpoint。

#### mail_ingests

保存 account_id、mailbox_folder、source_kind、source_key、raw_blob_key、raw_sha256、received_at、state、attempts、lease 和错误。

唯一键为 account_id + mailbox_folder + source_kind + source_key。IMAP source_key 为 UIDVALIDITY:UID，完整接收身份为账户、文件夹、UIDVALIDITY、UID。Message-ID 不作为接收唯一键。

所有 source 记录都保留，但入站业务应用另使用 account_id + raw_sha256 形成 inbound_application_key。它跨 UIDVALIDITY 和文件夹 source key 唯一，用于识别同一原始邮件的重复副本。

#### mail_threads

保存 ticket_id、account_id、root_message_id、最近入站/出站 Message-ID、reply token hash 和 legacy Zammad Ticket ID。

#### mail_messages

保存：

- direction 和 purpose。
- ingest_id 或 outbound idempotency_key。
- Message-ID、In-Reply-To、References。
- envelope 和 header 地址。
- subject。
- full 与 visible 的 text/html。
- parser version、quote method 和 confidence。
- classification。
- raw blob、raw SHA-256。
- inbound_application_key，入站时唯一。
- outbound state 和 accepted time。
- legacy_raw_unavailable。

#### mail_attachments

保存 blob、SHA-256、filename、size、content type、disposition、Content-ID、ordinal 和 Article 关联。

#### mail_delivery_attempts

保存 attempt number、开始/完成时间、SMTP 响应、错误分类和 provider acceptance ID。

#### mail_recipients

按 envelope recipient 保存 RCPT 响应、accepted、retry_wait、permanent_failed、delivered、bounced 等状态和 DSN 关联。邮件总体状态由全部收件人状态汇总，重试只能包含尚未被 relay 接受的收件人。

#### mail_suppressions

保存收件人规范值、hard bounce、complaint 或 manual 原因，以及来源和有效期。

### 6.3 迁移审计

- migration_runs
- migration_checkpoints
- migration_items
- migration_anomalies
- reconciliation_reports
- cutover_control
- cutover_events
- transaction_journal

每个 run 必须能回答：

- 使用了哪个源快照和水位。
- 每类实体读取、创建、更新、跳过和失败多少。
- 哪些记录的关系、大小或哈希不一致。
- 哪些历史数据源端已经不存在。
- 是否满足进入下一阶段的门槛。

异常只有两类：

- blocking_mismatch：源数据存在或状态未知，但目标缺失、不一致或未核验；必须阻止切换。
- verified_source_absence：已从所有权威在线源和备份证明迁移前就不存在；必须保存证据和影响，不能计入“已完整迁移”。

Migration run 状态为 blocked、verified 或 accepted_with_source_gaps。只有 verified 可以声明完整迁移；accepted_with_source_gaps 只能由预先配置的授权迁移审批人批准，普通 Customer、Staff 或一般业务 Admin 无权批准。审批记录必须保存审批人身份与角色、migration baseline ID、compatibility baseline ID、异常范围、理由和时间，所有缺失项仍永久可见。

## 7. Go 邮件客户端

### 7.1 初始选型

- IMAP：github.com/emersion/go-imap v1.2.1
- MIME：github.com/jhillyerd/enmime v1.3.0
- SMTP/MIME 构造：github.com/wneessen/go-mail v0.8.1

实施前应锁定校验和并完成依赖安全检查。初版使用可配置的短周期 UID 轮询；业务量较小时不需要先引入 IDLE。

### 7.2 入站流程

1. 对邮箱执行 EXAMINE。
2. 读取 UIDVALIDITY，并通过 UID SEARCH 获取实际 UID。
3. 以 BODY.PEEK[] 读取原始邮件，不改变已读状态。
4. 将 raw MIME 写入 BlobStore，计算 SHA-256。
5. 在 PostgreSQL 创建唯一 mail_ingest。
6. 按 UID SEARCH 返回的实际 UID 集合升序处理。只有集合中截至某 UID 的 raw MIME 与 ingest 全部持久化，才可把该账户与文件夹的 capture checkpoint 推进到该 UID；UID 数字自然缺口不视为失败。
7. 异步解析 MIME并先完成分类；只有 normal customer mail 进入线程匹配。
8. 对 normal customer mail，在一个数据库事务中写 mail_message、Ticket/Article、Thread 更新和 domain outbox。
9. 对 DSN 或退信，关联成功时在事务中更新对应出站消息与逐收件人状态；关联失败时进入 quarantine，均不创建普通客户 Article。
10. 自动回复、邮件列表或本站循环保存 raw MIME 和业务忽略原因；可疑或冲突邮件进入 quarantine。

mail_messages.ingest_id、inbound_application_key 和由入站生成的 Article 必须建立唯一关联，确保一个 source ingest 最多产生一次业务应用，同一 raw 邮件跨 source key 也最多应用一次。raw 已持久化后的解析或业务失败不阻止 capture checkpoint，而由 durable ingest 独立重试。

UIDVALIDITY 变化时，不能沿用旧 UID 水位。客户端应扫描对应账户与文件夹当前可见的全部 UID，而不是任意时间窗口，并通过账户、文件夹、新 source key、raw SHA-256 和业务幂等键消除重复。

### 7.3 MIME

必须覆盖：

- multipart/mixed、alternative、related 及嵌套组合。
- base64、quoted-printable 和常见字符集。
- RFC 2047 Header 与 RFC 2231 filename。
- text/plain 和 text/html 双轨保存。
- inline 附件、Content-ID、disposition 和顺序。
- 出站 alternative、related、mixed 的稳定构造。

raw MIME 永久保留。引用剥离只生成可重新计算的 visible body，不能覆盖 full body 或 raw MIME。

### 7.4 线程匹配

线程匹配只处理分类为 normal customer mail 的邮件。自动回复、邮件列表、DSN、退信和本站循环先进入各自处理路径，不得因为缺少线程信号而创建新工单。

按以下顺序判断：

1. 本系统生成的不可猜测 Reply-To token。
2. In-Reply-To 精确匹配本站已知出站 Message-ID。
3. References 与已知 thread anchor 相交。
4. 工单主题 token。
5. 对任何候选 thread 校验接收邮箱账户、租户边界，以及发件人是否属于工单参与者或明确允许的 CC。
6. 候选信号冲突或发件人授权失败时进入 quarantine。
7. 完全不匹配且分类为 normal customer mail 时创建新工单。

禁止使用“该发件人的最近工单”进行猜测。

历史 Zammad Article 的 Message-ID 必须导入 thread 索引。其 In-Reply-To 和 References 为空不能被自动补造。

### 7.5 入站分类与防循环

至少识别：

- Auto-Submitted。
- Precedence: bulk/list/junk。
- 常见 auto-reply header。
- 空 Return-Path。
- multipart/report delivery status。
- 本系统签名的 X-CSP-Origin。
- 已知出站 Message-ID。

自动回复、邮件列表、loop 和 quarantine 仍保存 raw MIME，不静默删除。DSN 和 bounce 关联成功时更新原出站消息和逐收件人状态，关联失败时进入 quarantine；“是否创建工单 Article”与“入站是否处理成功”是两个独立状态。

### 7.6 出站流程

1. 业务模块创建稳定 intent idempotency key。
2. Mail 模块生成并冻结 Message-ID、raw MIME 和收件人 envelope。
3. 在 PostgreSQL 写 queued 记录。
4. Worker 通过租约取得任务并发送。
5. 对每个 envelope recipient 记录 RCPT 响应和 delivery attempt。
6. RCPT 2xx 的收件人进入本次 DATA；RCPT 4xx 单独进入 retry_wait；RCPT 5xx 单独进入 permanent_failed。
7. 可证明 end-of-data 尚未完整发送时的临时失败，或 end-of-data 后收到明确最终 4xx，进入 retry_wait。
8. RCPT 或 end-of-data 后的明确最终 5xx，只把本次对应收件人置为 permanent_failed。
9. relay 最终 2xx 后，本次对应收件人进入 accepted，而不是 delivered。
10. end-of-data 可能已经完整发送但未取得最终结果时，本次对应收件人进入 uncertain，禁止自动重发。
11. 后续自动重试的 envelope 只能包含处于 retry_wait 的收件人。

稳定幂等键示例：

- agent-reply:<article-id>
- ticket-confirmation:<ticket-id>:v1
- status:<ticket-id>:<ticket-version>
- welcome:<customer-id>:v1
- reassignment:<ticket-id>:<assignment-version>:<old-owner>

首次排队后，重试必须复用同一 raw MIME 和 Message-ID。

下表是逐收件人 delivery attempt 的正式状态转换，不是整封邮件的状态：

| 当前状态 | 条件 | 下一状态 |
|---|---|---|
| queued | 取得有效租约 | sending |
| sending | 可证明 end-of-data 尚未完整发送，且错误可重试 | retry_wait |
| sending | end-of-data 后收到明确最终 4xx | retry_wait |
| sending | RCPT 或 end-of-data 后收到明确最终 5xx | permanent_failed |
| sending | 最终 2xx | accepted |
| sending | end-of-data 可能已完整发送但最终结果未知 | uncertain |
| retry_wait | 到达重试时间并取得租约 | sending |
| accepted | 收到成功 DSN 或 provider 事件 | delivered |
| accepted | 收到失败 DSN | bounced |
| uncertain | 取得 relay、provider 或收件侧接受证据 | accepted |
| uncertain | 核验后仍无法确定且决定不再发送 | permanent_unknown |
| uncertain | 授权邮件运维人员明确批准承担重复风险 | retry_wait |

uncertain 的人工转换必须保存操作者、证据、理由、时间和重复投递风险。进程崩溃或租约到期时，只有持久化阶段证据能证明 end-of-data 尚未完整发送，任务才可回到 retry_wait；其他 sending 一律进入 uncertain 等待核验。

mail_message.aggregate_state 只由逐收件人状态汇总，用于展示和告警，不能决定重试。只要存在 queued、sending 或 retry_wait 即为 in_progress；存在 uncertain 或 permanent_unknown 即为 uncertain；其余终态根据成功与失败收件人的组合标记 accepted、partial_failure 或 failed。

### 7.7 Worker

使用 PostgreSQL lease 或 FOR UPDATE SKIP LOCKED 处理任务，不引入外部队列。单个 ingest 或 outbound attempt 在同一时刻只能被一个 Worker 持有。Worker 崩溃后，入站任务可按幂等状态继续；出站任务必须按已持久化的 SMTP 阶段决定 retry_wait 或 uncertain，不能把 sending 一律改回 queued。

## 8. 业务邮件策略

不复制任意 Trigger DSL。第一阶段只实现已确认的策略：

- 新工单确认。
- Agent 对客户的邮件回复。
- 明确需要的状态通知。
- 欢迎或激活邮件。
- 改派通知。

规则：

- Agent 的 Email Article 本身就是对客户的邮件，不再额外发送“新回复通知”。
- 欢迎流程使用一次性激活链接，不在 Article 或 MailMessage 中保存临时密码。
- 每个策略由领域事件触发，并具有稳定幂等键。
- 当前 inactive 的 follow-up 和 owner-change 行为不会因迁移自动启用。
- 切换前以生产 Trigger 导出结果为最终行为基线。

## 9. 迁移流程

### 阶段 0：取得可恢复源

必须先取得并验证：

- Zammad PostgreSQL 备份。
- Zammad application_secret。
- Zammad 附件存储备份。
- 平台 PostgreSQL 备份。
- 实际应用服务器 UploadedFile 目录或对象存储备份。
- 邮件 channel、分组邮箱、签名、别名、follow-up 和 Trigger 配置导出。

至少完成一次隔离环境恢复演练。备份必须形成应用一致性快照：暂停相关写入、等待在途事务完成、记录数据库事务位置，并在同一冻结区间生成 Zammad 附件存储与 UploadedFile 的完整主键、路径、大小和哈希清单。不同时间点的数据库与文件副本不能作为一致快照。

密码迁移还必须逐用户统计 Zammad 实际认证方式和哈希格式。实例中存在的每种格式都要有由 Zammad 验证通过的固定测试向量；带 application_secret 的 Argon2、$argon2i$ 和 {sha2} 不能被当作同一种算法处理。

未完成以上项目时禁止进入生产切换。

### 阶段 1：兼容层

- 把直接 Zammad 调用集中到 Backend 接口。
- 保持 Next.js API 与 DTO。
- 为 Zammad mutation 和 Webhook 引入业务幂等键。
- 生成版本化兼容基线，包含 git commit、端点与方法、请求 schema、响应字段、状态码、权限矩阵、附件 URL 和 fixture 校验和。
- 添加 Go Adapter，但仍以 Zammad 为生产真相来源。

### 阶段 2：重复导入

- 从恢复后的备份导入用户、组、权限、工单、文章、附件和邮件元数据。
- 从 BlobStore 导入附件并计算 SHA-256。
- 导入平台关联 ID 和异常引用。
- 每次运行生成 reconciliation report。
- 导入过程可以重复执行，不影响 Zammad 生产写入。

### 阶段 3：影子读取

- 用户请求仍返回 Zammad 结果。
- 同时读取 Go，并在后台比较字段、数量、排序、权限和附件元数据。
- 差异只进入审计，不影响用户响应。
- 达到连续验收窗口后才能进入下一阶段。

### 阶段 4：邮件影子

- 在邮箱服务端启用可证明的保留策略、独立归档副本或专用副本邮箱，确保 Go 能读取每封原始邮件；仅靠 Go 与 Zammad 竞争读取同一 INBOX 不能作为完整性证明。
- Go 从独立原始来源读取 raw MIME，只解析和核验，不创建工单、不发送邮件。
- 对 Zammad 的每个出站 intent，Go 构造但不发送 MIME。
- 比较 envelope、To、Cc、subject、正文语义、附件 SHA-256、Content-ID 和线程 header。
- 不能让两个客户端同时执行破坏性收取，也不能让两个发送者同时有效。

### 阶段 5：增量追平

- 使用 updated_at + 主键水位，或数据库变更日志，循环导入新增和更新；最大 ID 只用于辅助检查。
- 周期性比较完整主键集合，识别删除项和源端消失项。
- 邮箱水位按账户、文件夹、UIDVALIDITY、UID 保存。
- 为每类实体定义版本化规范化规则，对全部应迁移字段生成逐条 canonical hash；范围包括用户字段、权限、Ticket 字段、Article 正文与邮件头、时间、标志位、附件元数据和 legacy_attributes。
- 对 Blob 生成 SHA-256。updated_at + 主键只用于发现候选变更，不能代替全字段核验。
- 在低流量窗口将差异缩小到可在短暂写冻结内完成。

### 阶段 6：切换

1. Next.js 暂停用户资料、密码、角色、组权限、out-of-office 和工单写操作，并等待在途请求、Webhook 和后台任务完成。新的凭据登录在身份切换完成前短暂暂停。
2. 对已通过影子验收的 Go Identity/Ticket 只读快照执行健康检查，并把读取路由切到该快照。现有 JWT Session 只用于读取；附件和文章读取也必须已通过兼容基线。健康检查失败时在停止 Zammad 前撤回切换。
3. 将持久化 cutover_control 中的 identity、ticket、inbound、outbound 状态推进到 paused，并增加 cutover epoch。
4. 先停止并隔离所有可能产生邮件 intent 的旧业务写入者：Zammad IMAP 入站、Web/API 写入、Trigger、Scheduler 和非发送类 Worker；等待在途业务事务完成。冻结期间到达邮箱的新邮件保留给 Go 重叠扫描。
5. 在确认不再产生新 intent 后，只允许隔离的 legacy outbound drain worker 处理既有队列；等待在途 SMTP 会话完成，排空并核验发送队列。任何结果不确定的旧投递必须先查明，不能通过关闭连接制造新的 uncertain。
6. 停止剩余 Zammad Web、Worker 和 Scheduler。轮换邮箱凭据且只授予 Go，撤销 Zammad API token 与数据库写权限，并通过网络规则阻止旧进程访问邮箱和生产数据库。
7. 在确认所有旧写入者停止后记录最终数据库事务位置、用户与凭据水位、Article 水位，以及 Zammad 已证明完成业务应用的连续 IMAP 水位：UID SEARCH 实际集合中截至该 UID 的每封邮件均有明确处理结果。从此处到 Go 对应 owner 激活之间，旧写入必须持续停止。禁止用 UIDNEXT 或停止时的邮箱最高 UID 代替已应用水位。
8. 生成最终动态主键清单，执行最后增量导入，并逐条核验用户、认证方式、密码哈希格式、权限、out-of-office、工单、文章、附件的版本化全字段 canonical hash 和全部 Blob SHA-256。核验通过后发布新的只读 snapshot epoch。
9. 记录 identity writer 切换事件并将 Identity Adapter 切换到 Go；恢复新的凭据登录。现有 JWT 标记为 pre-cutover session，在通过 Go 用户数据重新核验 active、role 和 group permission 前只允许只读访问；核验成功后刷新为当前 identity epoch，核验失败则失效并要求重新登录。
10. 记录 ticket writer 切换事件并将 Ticket Backend Adapter 切换到 Go；所有实例从 cutover_control 读取同一 epoch，旧 epoch 请求被拒绝。
11. 记录 inbound 切换事件并启用 Go 权威入站链路。Go 从不晚于最后 confirmed legacy applied UID 的重叠起点重新扫描；无法证明该水位时扫描当前文件夹全部 UID，并通过 source ingest、raw SHA-256、Message-ID 和 inbound_application_key 去重。
12. 核验 identity、ticket 和 inbound 后，记录 outbound 切换事件并启用 Go sender。
13. 恢复用户资料、权限、out-of-office 和工单写操作。

Identity writer、Ticket writer、权威入站链路和权威出站链路分别使用 legacy_active、paused、go_active 状态转换。多个系统之间不存在单个数据库原子事务，因此必须按顺序切换并记录各自时间、水位和 epoch。任何状态都不允许 legacy_active 与 go_active 同时成立。

延迟到达的旧 Zammad Webhook 必须携带或推导 legacy epoch；切换后只允许审计，不得再次产生业务副作用。

任何旧身份、工单或邮件写入都会使最终迁移基线立即失效，必须停止切换并从新的冻结点重新生成动态清单、哈希和水位。

### 阶段 7：观察

- Zammad 生产进程保持停止；数据库和附件快照保持不可变，不删除。需要查询时使用无外部写权限、无邮箱权限的隔离审计副本。
- 持续核对切换点前后至少 24 小时窗口。
- 监控 ingest、quarantine、uncertain、permanent failure、事件投递和附件访问。
- 观察期至少连续 7 天。期间必须没有 blocking_mismatch、系统自动或未经批准的重复投递、错误串单、未解释的数据漂移或未处理的旧 epoch 副作用；所有 quarantine、uncertain 和 failed 项均有结论，人工批准重试及其重复风险已单独披露，恢复演练仍通过。
- 满足条件并由授权迁移审批人签署退出记录后，才允许永久停用 Zammad 外部入口。退出记录保存观察起止时间、指标、异常和审批人。

## 10. 切换与恢复规则

必须区分两类恢复：

### 10.1 首次 Go 写入之前

尚未产生 Go 独有业务写入时，可以暂停切换并恢复 Zammad Adapter。此时不得启用 Go SMTP sender。

### 10.2 首次 Go 写入或邮件 accepted 之后

不能直接把开关切回 Zammad并宣称完成回退，因为：

- Zammad 不包含 Go 新写入的数据。
- 已被 SMTP 接受的邮件不能撤销。
- 直接双写可能产生不同 ID、重复文章和重复邮件。

此时采用“暂停写入、保全 transaction_journal 与 recovery_ledger、修复或受控重放、再恢复服务”的恢复流程。Go 的同步数据库副本、BlobStore、mail ingest/outbox、domain outbox、transaction_journal 和 recovery_ledger 是恢复依据。禁止删除 Go 数据或盲目重发邮件。

为了降低恢复时间：

- transaction_journal 位于 PostgreSQL，与业务写入和 domain outbox 处于同一事务，并由同步持久副本保护；每个事件可以幂等重放。
- recovery_ledger 位于 PostgreSQL 故障域之外的不可变 BlobStore，保存所有外部邮件 attempt 的发送前证据。
- 生产切换前必须演练数据库恢复和事件重放。
- 严重故障时可以暂时提供只读服务，优先保证数据不分叉。

### 10.3 灾难恢复边界

同一 PostgreSQL 中的业务表和 journal 只能保证事务一致，不能防止整个数据库损坏。生产最低要求：

- PostgreSQL 只有在提交记录已写入独立同步持久副本后才向应用确认成功，并启用连续 WAL 归档和 PITR。
- 对已确认的业务写入、入站 capture 和 outbound queue，在声明的生产故障域内最低保证为 RPO 0；最低 RTO 为 4 小时。故障域和恢复证据必须写入部署验收。
- transaction_journal 保存 entity type、entity ID、version、canonical hash、event ID 和 cutover epoch，并与业务写入和 domain outbox 处于同一事务。
- 每次外部邮件副作用执行前，另将 attempt ID、Message-ID、envelope recipients、raw SHA-256 和 cutover epoch 同步写入 PostgreSQL 故障域之外的不可变 recovery_ledger。恢复后缺少最终结果的 attempt 一律进入 uncertain。
- BlobStore 启用版本化或不可变保留和独立持久副本，防止误删覆盖；附件和 raw MIME 的清单与哈希另行备份。
- Blob 写入成功但数据库事务失败时，由审计任务清理孤立对象；数据库引用只在 Blob 已持久化后提交。
- 对外确认的入站 capture、业务写入或 outbound queue 必须已经进入可恢复持久层。

## 11. 验收门槛

### 11.1 数据

- 使用写冻结后的最终动态清单，而不是调查日固定数量，核验用户、工单、文章、分组、状态和优先级的完整主键集合。
- 所有新增、更新和删除项均已按 updated_at + 主键或数据库变更日志发现，并在最终冻结快照上逐条通过版本化全字段 canonical hash。
- canonical hash 覆盖每类实体的全部应迁移字段，包括正文、邮件头、时间、标志位和 legacy_attributes；字段规范化版本写入 reconciliation report。
- 所有已存在外键关系均有效。
- 历史数字 ID和 Ticket number 100% 一致。
- 最终附件清单中的全部 Zammad 附件都有大小和 SHA-256，字节核验一致；调查基线为 273 个。
- 当前 40 个 UploadedFile 的实际字节必须恢复并核验。只有授权迁移审批人明确批准降低无损范围后，已证明在调查前缺失的项目才可转为 accepted_with_source_gaps。
- 调查基线中的 3 条孤立 TicketRating 及最终发现的全部孤立历史记录仍保留。
- 所有 legacy_raw_unavailable 均有来源和原因。

### 11.2 身份

- 逐用户认证方式和哈希格式统计完成，实例中每种实际格式的固定 Zammad 测试向量均在 Go 验证成功。
- Active、inactive、role、group permission 和 out-of-office 对账通过。
- 现有 JWT 用户 ID 不变化。
- 现有 JWT Session 在冻结期间只读；Identity Adapter 启用后必须用 Go 的 active、role 和 group permission 重新核验，成功后刷新为当前 identity epoch，失败则失效并要求重新登录。
- 用户资料、密码、角色、组权限和 out-of-office 的最终冻结快照逐条核验通过。
- 首次成功登录重哈希不改变用户体验。

### 11.3 API 和权限

- 选定版本化兼容基线中的全部端点、字段、状态码、权限和 fixture 均通过，结果关联到 baseline ID 与 git commit。
- Customer、Staff、Admin 的可见、编辑、分配和关闭权限结果与当前行为一致。
- 列表、详情、搜索、导出、文章和附件行为通过影子比较。
- 历史附件 URL 可访问。

### 11.4 邮件

- 每个账户、文件夹、UIDVALIDITY、UID 组合恰好有一个 ingest。
- 每个 ingest 恰好应用一次，或有明确的业务忽略、delivery_applied、quarantine 原因。
- checkpoint 不越过未解决的较低 UID；UIDVALIDITY 变化后的当前文件夹全量 UID 已复核。
- 已知回复 thread 匹配率为 100%，不存在错误串单。
- 同一 outbound intent 的系统自动重复投递为 0；所有人工批准重试单独列出，不计入“零自动重复”。
- 每个 envelope recipient 的 RCPT、重试、accepted、uncertain、delivered 或 bounced 状态可审计；部分收件人失败不会导致已 accepted 收件人重复发送。
- envelope、To、Cc、subject、正文语义、附件数量、名称、大小、SHA-256 和 Content-ID 对账通过。
- Gmail、Outlook、Apple Mail、纯文本、六种业务语言、nested quote、CID、普通附件、DSN 和自动回复样本通过。
- uncertain、hard bounce 和 loop 可见且可人工处理。
- Zammad 禁用后发送数为 0；Go 启用前发送数为 0。

### 11.5 运维

- 完成一次备份恢复演练。
- 同步数据库副本、PITR、不可变 recovery ledger、Blob 版本恢复和清单核验满足已确认写入 RPO 0、RTO 4 小时的最低目标。
- 完成一次切换前撤回演练。
- 完成一次 Go 写入后的 journal 恢复演练。
- 完成一次旧 Worker 重启、延迟 Webhook 和多实例 epoch 传播演练，旧 epoch 不产生业务副作用。
- 直接调用旧 Zammad API、重启旧 Web/Worker/Scheduler 后，生产写入和邮件收发仍然失败。
- 监控、告警和审计报告可以定位到具体 run、ingest、message 和 event。

## 12. 已知限制

- 当前邮箱无法提供 94 封更早客户邮件的 raw MIME。
- 当前已发送文件夹不能提供可匹配的 Zammad 出站原件。
- 标准 SMTP 不提供全局 exactly-once delivery。
- 未完成认证方式、哈希格式清单并取得所需 application_secret 前，原密码连续性不能证明。
- 未取得实际应用服务器文件备份前，40 个 UploadedFile 的字节完整性不能证明。
- 12 个 Zammad 附件仍需从存储备份完成直接核验。

94 封历史入站 raw MIME 和无法匹配的历史出站 raw MIME 可以作为已证明的源端缺失进入 accepted_with_source_gaps。40 个 UploadedFile 和 12 个待核验 Zammad 附件目前仍是 blocking_mismatch，不得在未取得新证据或授权迁移审批人明确降低范围时标记为通过。

只要存在 permanent_unknown 或人工批准重试，系统只能声明“零自动重复投递”，不能声明外部收件侧全局重复数为零。

这些限制必须通过显式状态和审计记录表达，不能用默认值或合成数据隐藏。

## 13. 设计决策

| 决策 | 结果 |
|---|---|
| 部署形态 | Go 模块化单体 |
| 数据库 | 继续使用 PostgreSQL |
| 前端 | 保留 Next.js/React |
| API 兼容 | Next.js BFF 保持稳定 |
| ID | 保留历史数字 ID |
| 邮件服务 | 继续使用现有企业邮箱 |
| 邮件接入 | IMAP UID 轮询 + SMTP |
| 大对象 | BlobStore，生产对象存储 |
| 队列 | PostgreSQL lease/outbox |
| Trigger | 明确领域策略，不复制通用 DSL |
| 历史 raw MIME 缺失 | legacy_raw_unavailable |
| SMTP 不确定结果 | uncertain，禁止自动重发 |
| 生产恢复 | durable journal + 受控重放 |
