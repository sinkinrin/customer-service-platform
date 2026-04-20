## 上下文

FAQ 系统当前已经是一个 **自建、Prisma 驱动、本地持久化** 的能力，不再依赖 Zammad Knowledge Base。

当前代码事实：

- 数据库：Prisma + PostgreSQL
- 客户侧 FAQ API：`src/app/api/faq/*`
- Admin FAQ CRUD：`src/app/api/admin/faq/*`
- 多语言内容：`FaqArticleTranslation`
- 用户评分：`FaqRating`
- 轻量缓存：`src/lib/cache/simple-cache.ts`

本设计文档的职责不再是讨论“是否要自建 FAQ”，而是说明当前 FAQ 设计的约束、取舍与边界。

## 目标 / 非目标

### 目标

- 用本地数据库保存 FAQ 分类、文章与多语言翻译
- 提供 Admin 侧 FAQ 分类/文章管理能力
- 支持客户侧 FAQ 列表、详情、搜索与评分
- 用轻量缓存降低热点 FAQ 请求开销
- 保持与现有前端与国际化体系兼容

### 非目标

- 不把 FAQ 建成 Zammad KB 的镜像层
- 不引入独立搜索基础设施（如 Elasticsearch）作为当前前提
- 不引入重型分布式缓存前置依赖
- 不在本设计中承诺复杂内容工作流、审批流或版本管理系统

## 设计决策

### 决策：存储模型

- FAQ 使用 Prisma 本地模型保存，而不是走 Zammad KB
- 当前数据库提供方是 PostgreSQL，而不是 SQLite
- FAQ 通过文章主记录 + 翻译子记录的方式支持多语言

相关模型：

- `FaqCategory`
- `FaqArticle`
- `FaqArticleTranslation`
- `FaqRating`

### 决策：搜索实现

- 当前搜索以 FAQ API 中的应用层过滤为主
- 搜索基于标题、内容、关键词进行匹配
- 不把 SQLite FTS5 视为当前实现前提

这意味着当前 FAQ 搜索是“够用且简单”的方案，而不是一个重型搜索系统。

### 决策：缓存策略

- 当前使用轻量内存缓存，而不是 Redis
- FAQ 列表与分类会走 `src/lib/cache/simple-cache.ts`
- Admin 侧写操作会主动清理相关缓存

这符合当前项目的部署复杂度和已有实现。

### 决策：多语言支持

- FAQ 翻译与项目现有 `next-intl` 语言集合保持一致
- 文章内容按 locale 分开存储
- 客户侧 API 会按请求 language 返回对应翻译

### 决策：评分反馈

- FAQ 文章支持 helpful / not helpful 评分
- 单个用户对单篇文章只保留一条评分记录
- 评分结果用于前端展示与内容优化反馈

## 当前边界

### 当前实现已覆盖的能力

- FAQ 分类浏览
- FAQ 文章列表与详情
- FAQ 关键词搜索
- FAQ 点赞/点踩
- Admin FAQ 分类/文章 CRUD
- 多语言翻译存储
- 基础缓存与缓存失效

### 当前实现未承诺的能力

- 高级全文检索引擎
- Redis 分布式缓存
- FAQ 审批流 / 发布流 / 版本管理
- 专门的 FAQ 评分分析后台
- FAQ 与外部知识库双向同步

这些如果未来需要，应通过新的 OpenSpec change 来扩展，而不是写成当前事实。

## 风险 / 权衡

### 权衡：简单搜索 vs 重型搜索

- 当前选择：应用层查询 + 关键词匹配
- 优点：实现简单、维护成本低、与现有 schema 一致
- 缺点：当 FAQ 规模大幅增长时，搜索质量和性能可能不如专用搜索引擎

### 权衡：内存缓存 vs 分布式缓存

- 当前选择：轻量本地缓存
- 优点：无需新增基础设施，和现有代码匹配
- 缺点：多实例部署时缓存不共享

### 风险：文档历史漂移

FAQ 领域历史上出现过多版不同方向的设计，包括：

- Zammad KB 方案
- SQLite 方案
- Redis / FTS5 方案

缓解方式：

- 所有“当前实现”判断以 `src/app/api/faq/*`、`src/app/api/admin/faq/*` 和 `prisma/schema.prisma` 为准
- 本设计文档只记录仍然影响当前判断的设计边界

## 演进方向

未来如果 FAQ 规模和复杂度继续上升，可以考虑：

1. 改进搜索相关性排序
2. 引入更强的全文索引方案
3. 增加 FAQ 导入/导出能力
4. 增加更细的后台分析能力
5. 增加内容工作流能力

但这些都属于未来 change，不属于当前已实现事实。
