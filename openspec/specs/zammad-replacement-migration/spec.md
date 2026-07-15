# zammad-replacement-migration Specification

## Purpose

定义以 Go 替代 Zammad 身份、工单、附件和邮件能力时必须长期保持的数据兼容、邮件可靠性、迁移审计与切换安全约束。

## Requirements

### Requirement: 保持历史业务标识

系统 SHALL 保留已有 Zammad User、Ticket、Article 的数字 ID、Ticket number，以及 zammad-<user_id> 本地身份格式。

#### Scenario: 读取历史工单

- **GIVEN** 某工单在 Zammad 中的 ID 和 number 已被页面、本地表或外部链接引用
- **WHEN** 系统切换到 Go 后读取该工单
- **THEN** 系统 SHALL 返回相同的 ID 和 number
- **AND** 现有链接 SHALL NOT 因迁移失效

#### Scenario: 创建新实体

- **GIVEN** 历史数据已经导入
- **WHEN** Go 创建新的用户、工单或文章
- **THEN** 新数字 ID SHALL 大于对应历史最大值
- **AND** 系统 SHALL 通过唯一约束阻止 ID 或工单编号冲突

### Requirement: 保持现有应用接口

系统 SHALL 在切换前建立版本化兼容基线。基线 SHALL 明确记录 git commit、端点与方法、请求 schema、响应字段、状态码、权限矩阵、附件 URL 和 fixture 校验和。切换后的行为 SHALL 通过该基线验收。

#### Scenario: 前端切换后继续访问

- **WHEN** Backend Adapter 从 Zammad 切换到 Go
- **THEN** 浏览器 SHALL 继续使用基线记录的 API 路径
- **AND** 基线内全部兼容用例 SHALL 通过
- **AND** 前端 SHALL NOT 要求同时发布一次性重写

#### Scenario: 访问历史附件

- **GIVEN** 历史正文或页面引用现有附件代理 URL
- **WHEN** 用户在切换后访问该 URL
- **THEN** 系统 SHALL 通过原有 ticket、article、attachment 定位语义返回相同附件
- **AND** 系统 SHALL 通过兼容基线中的附件权限用例

### Requirement: 迁移过程可重复并可审计

系统 SHALL 为每次迁移保存唯一 run ID、源快照、水位、实体结果、哈希、异常和完成状态。重复执行同一来源 SHALL NOT 创建重复业务实体。

#### Scenario: 重复执行导入

- **GIVEN** 某源记录已经在较早的 migration run 中成功导入
- **WHEN** 同一源记录再次被扫描
- **THEN** 系统 SHALL 按 source system、source entity type 和 source ID 幂等核验或更新
- **AND** 系统 SHALL NOT 创建第二个业务实体

#### Scenario: 迁移记录不一致

- **WHEN** 源数据存在或状态未知，且目标的数量、关系、大小或哈希不一致
- **THEN** migration run SHALL 被标记为未通过
- **AND** 系统 SHALL 保存可定位到源记录的 anomaly
- **AND** 生产切换 SHALL 被阻止

#### Scenario: 已证明的源端缺失

- **GIVEN** 数据在迁移开始前已无法从全部权威在线源和备份恢复
- **WHEN** 调查证据确认源端缺失
- **THEN** 系统 SHALL 将 anomaly 标记为 verified_source_absence
- **AND** anomaly SHALL 保存证据来源和影响
- **AND** 该项 SHALL NOT 计入完整迁移
- **AND** 只有预先配置的授权迁移审批人批准后，migration run MAY 标记 accepted_with_source_gaps
- **AND** 审批记录 SHALL 保存审批人身份与角色、migration baseline ID、compatibility baseline ID、异常范围、理由和时间
- **AND** 普通 Customer、Staff 或一般业务 Admin SHALL NOT 拥有该审批权限

#### Scenario: 生成最终迁移基线

- **WHEN** 系统准备执行最终迁移验收
- **THEN** 系统 SHALL 在暂停相关写入并等待在途事务完成后建立应用一致性快照
- **AND** 快照 SHALL 记录数据库事务位置以及附件和文件 Blob 清单
- **AND** 系统 SHALL 核验完整主键集合、新增、更新、删除、版本化全字段 canonical hash 和 Blob SHA-256
- **AND** canonical hash SHALL 覆盖每类实体的全部应迁移字段，包括正文、邮件头、时间、标志位和 legacy attributes
- **AND** 调查日的固定数量 SHALL NOT 代替最终动态清单

### Requirement: 附件保持字节完整

系统 SHALL 保存每个迁移附件的大小、SHA-256、MIME 类型、disposition、Content-ID 和顺序，并在切换前核验可恢复附件的原始字节。

#### Scenario: 附件成功迁移

- **WHEN** 附件从 Zammad 存储或平台文件存储迁移到 BlobStore
- **THEN** 目标大小和 SHA-256 SHALL 与源一致
- **AND** 迁移审计 SHALL 记录核验结果

#### Scenario: 源文件不存在

- **WHEN** 元数据存在但源文件字节无法从在线系统或备份恢复
- **THEN** 系统 SHALL 保留元数据和缺失原因
- **AND** 系统 SHALL NOT 生成替代字节或把该项标记为完整
- **AND** 在源端缺失尚未被证明并明确接受前，生产切换 SHALL 被阻止

### Requirement: 密码连续性必须经过兼容验证

系统 SHALL 逐用户统计 Zammad 实际认证方式和密码哈希格式。系统仅在取得所需密码哈希、对应 application_secret，并为实例中每种实际格式通过固定测试向量后，声明用户原密码可以无感迁移。

#### Scenario: 首次使用旧密码登录

- **GIVEN** 用户拥有属于已验证格式的 Zammad 密码哈希
- **WHEN** Go 使用兼容验证器成功验证用户原密码
- **THEN** 系统 SHALL 允许登录
- **AND** 系统 SHALL 将密码转换为新系统哈希
- **AND** 系统 SHALL NOT 保存明文密码

#### Scenario: 缺少密码迁移材料

- **GIVEN** 某实际认证或哈希格式所需的密码哈希、application_secret 或验证材料缺失
- **WHEN** 准备停用 Zammad 身份验证
- **THEN** 系统 SHALL 阻止“原密码无感迁移已完成”的验收结论
- **AND** 系统 SHALL 对受影响用户执行明确的激活或重置流程

#### Scenario: 切换身份验证

- **WHEN** 系统准备把 Identity Adapter 从 Zammad 切换到 Go
- **THEN** 系统 SHALL 暂停用户资料、密码、角色、组权限和 out-of-office 写入
- **AND** 系统 SHALL 对最终用户与凭据快照执行逐条核验
- **AND** 新的凭据登录 SHALL 只在 identity paused 窗口内短暂拒绝
- **AND** 现有 zammad-<user_id> JWT Session SHALL 在冻结期间继续只读访问
- **AND** Go Identity Adapter 启用后 SHALL 使用迁移后的 active、role 和 group permission 重新核验旧 Session
- **AND** 核验成功的 Session SHALL 刷新为当前 identity epoch 后恢复正常权限
- **AND** 核验失败的 Session SHALL 失效并要求重新登录
- **AND** Go Identity Adapter 启用后 SHALL 恢复新登录

### Requirement: 入站邮件先保全后应用

系统 SHALL 在推进 IMAP 水位前保存完整 raw MIME、SHA-256 和唯一接收身份。接收身份 SHALL 包含邮件账户、文件夹、UIDVALIDITY 和 UID，业务应用 SHALL 对该身份幂等。

#### Scenario: 正常收取 IMAP 邮件

- **WHEN** Worker 通过不改变邮件状态的方式取得某 UID 的 raw MIME
- **THEN** 系统 SHALL 先将 raw MIME 写入 BlobStore
- **AND** 系统 SHALL 保存账户、文件夹、UIDVALIDITY、UID 和 SHA-256
- **AND** 系统 SHALL 仅在持久化成功后推进 checkpoint

#### Scenario: Worker 在应用前崩溃

- **GIVEN** raw MIME 已保存但工单文章尚未创建
- **WHEN** Worker 重新处理该 ingest
- **THEN** 系统 SHALL 继续同一个 ingest
- **AND** 系统 SHALL NOT 创建重复 Ticket 或 Article
- **AND** ingest 与由其生成的 Article SHALL 保持唯一关联

#### Scenario: UIDVALIDITY 改变

- **WHEN** 邮箱 UIDVALIDITY 与已保存值不同
- **THEN** 系统 SHALL 停止沿用该账户与文件夹的旧 UID checkpoint
- **AND** 系统 SHALL 在相同账户与文件夹范围内复核当前可见的全部 UID
- **AND** 系统 SHALL 通过接收身份、raw hash 和业务幂等键阻止重复应用

#### Scenario: 较低 UID 尚未保全

- **GIVEN** UID SEARCH 返回的实际 UID 集合中，某个较低 UID 的 raw MIME 和 ingest 尚未完成持久化
- **WHEN** 更高 UID 已处理成功
- **THEN** checkpoint SHALL NOT 越过未解决的较低 UID

#### Scenario: raw 邮件跨 source key 重复出现

- **GIVEN** 同一账户中的相同 raw MIME 因 UIDVALIDITY 变化或文件夹副本获得不同接收身份
- **WHEN** 系统准备应用后一个 ingest
- **THEN** 系统 SHALL 使用包含账户和 raw SHA-256 的业务应用键识别重复
- **AND** 系统 SHALL 保留两个 source ingest 的审计记录
- **AND** 系统 SHALL 最多创建一次业务 Article

### Requirement: 邮件线程不得猜测

系统 SHALL 先完成邮件分类，仅对 normal customer mail 使用 Reply-To token、In-Reply-To、References 和受约束的工单 token 匹配线程。任何候选 thread 都 SHALL 校验邮件账户、租户边界和发件人参与者权限；信号冲突或授权失败时 SHALL 隔离处理。

#### Scenario: 回复命中已知 Message-ID

- **WHEN** 入站邮件的 In-Reply-To 匹配本站已知出站 Message-ID
- **THEN** 系统 SHALL 先校验邮件账户、租户和发件人参与者权限
- **AND** 校验通过后 SHALL 将邮件关联到对应 thread
- **AND** 系统 SHALL 在同一事务内创建 Article 和更新 thread

#### Scenario: 线程信号冲突

- **WHEN** Reply-To token、In-Reply-To、References 或工单 token 指向不同工单
- **THEN** 系统 SHALL 将邮件置为 quarantine
- **AND** 系统 SHALL NOT 自动写入任何候选工单

#### Scenario: 普通客户邮件没有线程信号

- **GIVEN** 入站邮件已经分类为 normal customer mail
- **WHEN** 邮件不存在可验证的 thread 信号
- **THEN** 系统 SHALL 创建新工单
- **AND** 系统 SHALL NOT 使用发件人的最近工单进行猜测

### Requirement: 保留邮件原始数据和不可恢复状态

系统 SHALL 保留切换水位之后每封邮件的 raw MIME。历史 raw MIME 在源端不存在时 SHALL 标记 legacy_raw_unavailable。

#### Scenario: 历史 Article 没有 raw MIME

- **GIVEN** Zammad Article 仍存在但邮箱和备份均没有对应 raw MIME
- **WHEN** 迁移该 Article
- **THEN** 系统 SHALL 迁移可用的 header、正文和附件
- **AND** mail message SHALL 标记 legacy_raw_unavailable
- **AND** 系统 SHALL NOT 合成并冒充原始 MIME

#### Scenario: 新入站邮件

- **WHEN** 邮件在 Go 启用后的水位被接收
- **THEN** 系统 SHALL 保存可按字节审计的 raw MIME 和 SHA-256

### Requirement: 出站意图和投递尝试可审计

系统 SHALL 为每个逻辑出站意图保存稳定幂等键、冻结的 Message-ID、raw MIME、独立 delivery attempt 和逐 envelope recipient 状态。

#### Scenario: 明确临时失败

- **WHEN** 系统能证明 end-of-data 终止符尚未完整发送，且 SMTP 返回临时错误或连接明确失败
- **THEN** 系统 MAY 按策略重试
- **AND** 重试 SHALL 复用相同 Message-ID 和 raw MIME

#### Scenario: end-of-data 后收到明确最终 4xx

- **WHEN** end-of-data 已完整发送且 relay 返回明确最终 4xx
- **THEN** 系统 SHALL 将本次对应收件人置为 retry_wait
- **AND** 系统 SHALL NOT 将其标记 uncertain

#### Scenario: end-of-data 后收到明确最终 5xx

- **WHEN** end-of-data 已完整发送且 relay 返回明确最终 5xx
- **THEN** 系统 SHALL 将本次对应收件人置为 permanent_failed
- **AND** 系统 SHALL NOT 将其标记 uncertain

#### Scenario: SMTP 接受邮件

- **WHEN** SMTP relay 返回最终 2xx 并明确接受本次 envelope recipients
- **THEN** 系统 SHALL 将对应收件人标记 accepted
- **AND** 系统 SHALL NOT 把 accepted 等同于 delivered

#### Scenario: DATA 后结果不确定

- **WHEN** end-of-data 可能已经完整发送，但系统无法取得或确认最终 SMTP 结果
- **THEN** 系统 SHALL 将本次对应收件人标记 uncertain
- **AND** 系统 SHALL 禁止自动重发
- **AND** 系统 SHALL 提供人工核验所需的 attempt 和 Message-ID

#### Scenario: 部分收件人失败

- **WHEN** 同一次 SMTP 会话的 RCPT 响应同时包含 2xx、4xx 或 5xx
- **THEN** 系统 SHALL 分别保存每个 envelope recipient 的状态和响应
- **AND** 后续重试 SHALL 只包含尚未 accepted 或 uncertain 的临时失败收件人
- **AND** 已 accepted 收件人 SHALL NOT 因其他收件人失败而再次接收

#### Scenario: 发送 Worker 在发送中失效

- **GIVEN** delivery attempt 仍为 sending
- **WHEN** Worker 崩溃或任务认领过期
- **THEN** 只有持久化证据证明 end-of-data 尚未完整发送时才 MAY 进入 retry_wait
- **AND** 其他情况 SHALL 进入 uncertain

#### Scenario: 人工处理 uncertain

- **GIVEN** 某收件人的投递状态为 uncertain
- **WHEN** 授权邮件运维人员完成核验
- **THEN** 系统 SHALL 根据证据将其置为 accepted、permanent_unknown，或明确批准后置为 retry_wait
- **AND** 系统 SHALL 保存操作者、证据、理由、时间和重复投递风险

#### Scenario: 报告重复投递保证

- **GIVEN** 存在 permanent_unknown 或人工批准重试
- **WHEN** 系统生成投递验收报告
- **THEN** 系统 SHALL 只声明系统自动重复投递数量
- **AND** 系统 SHALL 单独披露未知结果、人工重试和重复风险
- **AND** 系统 SHALL NOT 声明外部收件侧全局重复数量为零

### Requirement: 邮件循环、自动回复和退信可见

系统 SHALL 对自动回复、邮件列表、DSN、退信和本站循环进行分类，并保留对应 raw MIME 和处理原因。

#### Scenario: 识别自动回复

- **WHEN** 入站邮件包含可验证的 Auto-Submitted 或常见自动回复信号
- **THEN** 系统 SHALL 阻止其触发普通客户回复策略
- **AND** 系统 SHALL 保存 ignored 原因

#### Scenario: 识别硬退信

- **WHEN** 系统确认某收件人发生 hard bounce
- **THEN** 系统 SHALL 关联原出站消息
- **AND** 系统 SHALL 创建 suppression
- **AND** 后续普通发送 SHALL 遵守该 suppression

#### Scenario: 识别 DSN 或本站循环

- **WHEN** 入站邮件被分类为 DSN 或本站循环
- **THEN** 系统 SHALL 尝试关联已知出站消息
- **AND** 关联成功的 DSN SHALL 更新对应收件人的投递状态
- **AND** 关联失败的 DSN SHALL 进入 quarantine 并保存待人工核验原因
- **AND** 系统 SHALL NOT 创建普通客户工单

#### Scenario: 识别邮件列表或批量邮件

- **WHEN** 入站邮件被分类为邮件列表或批量邮件
- **THEN** 系统 SHALL 保存 raw MIME 和分类依据
- **AND** 系统 SHALL NOT 创建普通客户工单

### Requirement: 单一权威邮件链路

系统 SHALL 保证任一时刻只有一条权威入站处理链路和一条权威出站发送链路。链路内部 MAY 并发运行多个 Worker，但同一 ingest 或 delivery attempt 在同一时刻 SHALL 只由一个 Worker 独占处理。

#### Scenario: 邮件影子阶段

- **GIVEN** Zammad 仍负责生产邮件
- **WHEN** Go 进行影子验证
- **THEN** 邮箱服务 SHALL 通过保留策略、独立归档或专用副本提供可证明完整的 raw MIME 来源
- **AND** Go MAY 保存或解析该副本
- **AND** Go SHALL NOT 创建生产工单文章
- **AND** Go SHALL NOT 发送邮件

#### Scenario: 切换到 Go

- **WHEN** Go 入站或出站能力被启用
- **THEN** 对应 Zammad 消费者或发送策略 SHALL 已停止
- **AND** 切换水位和时间 SHALL 被审计记录

### Requirement: 业务事件幂等

系统 SHALL 将 Ticket 和 Mail 领域事件与业务写入保存在同一 PostgreSQL 事务中，并使用唯一 event ID 投递到 Next.js。

#### Scenario: 事件重复投递

- **GIVEN** Next.js 已经处理某 event ID
- **WHEN** outbox 因响应丢失再次投递相同事件
- **THEN** Next.js SHALL 返回幂等成功
- **AND** TicketUpdate、Notification 和邮件 intent SHALL NOT 重复创建

### Requirement: 生产切换受验收门槛保护

系统 SHALL 使用明确的 migration baseline ID 和 compatibility baseline ID 验收数据、身份、API、权限、附件、邮件和恢复演练。只有 migration run 为 verified，或由授权迁移审批人批准为 accepted_with_source_gaps，才允许生产切换。

#### Scenario: 存在阻断差异

- **WHEN** reconciliation report 中存在 blocking_mismatch，或 verified_source_absence 尚未取得明确接受记录
- **THEN** 生产 Backend Adapter SHALL 保持指向 Zammad
- **AND** Go SMTP sender SHALL 保持禁用

#### Scenario: 执行生产切换

- **GIVEN** 影子验证和切换前验收已经通过
- **WHEN** 生产切换开始
- **THEN** 系统 SHALL 先暂停身份与工单写入，并停止所有可产生邮件 intent 的旧入站、Trigger、Scheduler 和业务 Worker
- **AND** 系统 SHALL 等待在途业务事务完成并证明不再产生新 intent
- **AND** 系统 SHALL 再由隔离的 legacy outbound drain worker 排空既有发送队列
- **AND** 系统 SHALL 在停止 Zammad Web 前把读取路由切换到已通过兼容基线的 Go 只读快照
- **AND** Go 只读快照健康检查失败时 SHALL 撤回切换并保持 Zammad 可用
- **AND** 系统 SHALL 在连续暂停期间建立最终一致性快照、执行最终增量导入并完成 migration 与 compatibility baseline 验收
- **AND** 最终核验通过后 SHALL 发布新的只读 snapshot epoch
- **AND** 系统 SHALL 在最终用户、凭据和权限核验后切换唯一 Identity writer
- **AND** 系统 SHALL 再切换唯一 Ticket writer
- **AND** 系统 SHALL 在停止 Zammad 入站处理并记录邮箱水位后启用 Go 权威入站链路
- **AND** 系统 SHALL 在 Zammad 出站队列为空、在途会话完成且发送策略停止后启用 Go sender
- **AND** Identity writer、Ticket writer、入站链路和出站发送者的每个切换步骤 SHALL 分别记录状态、时间、水位和 cutover epoch
- **AND** 任一步骤 SHALL NOT 让 legacy 与 Go 同时处于 active
- **AND** Zammad 生产进程 SHALL 保持停止，其数据库和附件快照 SHALL 在观察期保持不可变

#### Scenario: 确定入站切换起点

- **GIVEN** Zammad 入站处理已经停止
- **WHEN** 系统记录邮件切换水位
- **THEN** 水位 SHALL 表示 UID SEARCH 实际集合中截至该 UID 的每封邮件均已被 Zammad 明确完成业务应用
- **AND** 系统 SHALL NOT 使用 UIDNEXT 或停止时的邮箱最高 UID 作为已应用水位
- **AND** Go SHALL 从不晚于该水位的重叠起点重新扫描
- **AND** 无法证明水位时，Go SHALL 扫描当前文件夹全部 UID 并执行跨 source key 幂等核验

#### Scenario: 冻结期间出现旧写入

- **GIVEN** 最终一致性快照已经开始
- **WHEN** 任一旧身份、工单或邮件写入发生
- **THEN** 当前最终 baseline SHALL 立即失效
- **AND** 系统 SHALL NOT 激活对应 Go owner
- **AND** 系统 SHALL 从新的连续冻结点重新生成动态清单、哈希和水位

#### Scenario: 旧进程在切换后恢复运行

- **GIVEN** cutover epoch 已推进且 Go 已成为某子系统的 active owner
- **WHEN** 旧 Worker、延迟 Webhook 或旧配置实例再次尝试产生副作用
- **THEN** 读取 cutover epoch 的新栈实例 SHALL 拒绝该副作用或只保存审计记录
- **AND** 不读取 epoch 的旧 Zammad Web、Worker 和 Scheduler SHALL 在切换前停止
- **AND** 系统 SHALL 轮换邮箱凭据、撤销旧 API token 和数据库写权限，并阻止旧进程访问邮箱与生产数据库
- **AND** 切换验收 SHALL 证明直接调用旧 API 或重启旧进程仍无法产生生产写入或邮件副作用

#### Scenario: 结束观察期

- **GIVEN** Go 已成为 Ticket、入站和出站的 active owner
- **WHEN** 系统准备永久停用 Zammad 外部入口
- **THEN** 观察期 SHALL 已连续运行至少 7 天
- **AND** 期间 SHALL 不存在 blocking_mismatch、系统自动或未经批准的重复投递、错误串单、未解释的数据漂移或未处理的旧 epoch 副作用
- **AND** quarantine、uncertain 和 failed 项 SHALL 全部具有处理结论
- **AND** 人工批准重试和重复风险 SHALL 已单独披露
- **AND** 授权迁移审批人 SHALL 保存包含观察起止时间、指标、异常和审批人的退出记录

### Requirement: 切换后的恢复不得造成数据分叉

系统 SHALL 区分首次 Go 写入前的撤回与首次 Go 写入后的恢复。首次 Go 写入或邮件 accepted 后，系统 SHALL NOT 通过简单开关回到未同步的 Zammad。

#### Scenario: 首次 Go 写入前撤回

- **GIVEN** Go 尚未产生独有业务写入且未发送邮件
- **WHEN** 切换被取消
- **THEN** 系统 MAY 恢复 Zammad Adapter
- **AND** 系统 SHALL 保持 Go sender 禁用

#### Scenario: Go 已产生新数据

- **GIVEN** Go 已创建业务数据或 SMTP 已接受邮件
- **WHEN** Go 出现严重故障
- **THEN** 系统 SHALL 暂停新的写入
- **AND** 系统 SHALL 从同步数据库副本、BlobStore、transaction_journal 和 recovery_ledger 恢复或受控重放
- **AND** 系统 SHALL NOT 删除 Go 独有数据或盲目重发邮件

### Requirement: 持久化数据具备灾难恢复能力

系统 SHALL 为 PostgreSQL 提供同步独立持久副本和连续恢复能力，为 BlobStore 提供版本保护或不可变保留，并 SHALL 对业务数据、transaction_journal、recovery_ledger、附件和 raw MIME 执行可验证的恢复演练。在声明的生产故障域内，已确认业务写入、入站 capture 和 outbound queue 的最低保证 SHALL 为 RPO 0、RTO 4 小时。

transaction_journal SHALL 位于 PostgreSQL，并与业务写入和 domain outbox 处于同一事务；它保存实体、版本、canonical hash、event ID 和 cutover epoch。recovery_ledger SHALL 位于 PostgreSQL 故障域之外的不可变持久层，并在每次外部邮件 attempt 前同步保存 attempt ID、Message-ID、envelope recipients、raw SHA-256 和 cutover epoch。

#### Scenario: PostgreSQL 整体故障

- **WHEN** 主 PostgreSQL 无法继续使用
- **THEN** 系统 SHALL 从同步持久副本、备份和连续日志恢复
- **AND** 已经向应用确认的事务 SHALL NOT 丢失
- **AND** transaction_journal、业务写入和 domain outbox SHALL 保持事务一致

#### Scenario: Blob 被误删或覆盖

- **WHEN** 附件或 raw MIME 的当前 Blob 版本被误删或覆盖
- **THEN** 系统 SHALL 能从受保护版本恢复原字节
- **AND** 恢复后的 SHA-256 SHALL 与审计清单一致

#### Scenario: Blob 已写入但数据库事务失败

- **WHEN** Blob 已持久化但引用它的数据库事务未提交
- **THEN** 系统 SHALL NOT 向外确认对应业务操作成功
- **AND** 系统 SHALL 通过审计任务识别并处理孤立 Blob

#### Scenario: 恢复外部邮件副作用

- **GIVEN** 系统在发送前已将 attempt ID、Message-ID、envelope recipients、raw SHA-256 和 cutover epoch 同步写入不可变 recovery_ledger
- **WHEN** 数据库故障恢复后缺少该 attempt 的最终 SMTP 结果
- **THEN** 对应收件人 SHALL 被标记 uncertain
- **AND** 系统 SHALL NOT 自动重发

### Requirement: 使用轻量运行依赖

替代系统 SHALL 使用 PostgreSQL 承担业务持久化、outbox、任务认领和重试状态，并 SHALL NOT 以 Redis、Kafka 或 Elasticsearch 作为工单与邮件正确性的必要依赖。

#### Scenario: Worker 协调

- **WHEN** 多个 Worker 竞争待处理任务
- **THEN** 系统 SHALL 使用持久化、排他的任务认领机制协调
- **AND** Worker 崩溃后任务 SHALL 可根据持久化状态恢复
