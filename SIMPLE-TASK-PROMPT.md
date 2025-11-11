# FAQ 系统实现任务 - 简版提示词

## 项目背景
客户服务平台需要实现自建 FAQ 知识库，替代当前 mock 数据。用户量几百，并发几十。

## 技术栈
- 数据库：SQLite
- ORM：Prisma
- 框架：Next.js 14 (App Router) + TypeScript
- UI：现有 shadcn/ui 组件

## 核心功能要求

### 1. 数据库设计
创建表：
- faq_categories (分类)
- faq_articles (文章)
- faq_article_translations (多语言)
- faq_ratings (用户评分：点赞/点踩)

### 2. 后端实现
API 端点：
- GET /api/faq/categories - 获取分类
- GET /api/faq - 搜索文章
- GET /api/faq/[id] - 获取文章详情
- POST /api/faq/[id]/rating - 提交评分

管理端点：
- POST/PUT/DELETE /api/faq/categories - 分类管理
- POST/PUT/DELETE /api/faq - 文章管理

### 3. 前端更新
- 修改现有 FAQ 页面使用真实数据
- 添加评分功能组件
- 保持现有 UI 风格

### 4. 性能优化
- 简单缓存机制（可选）
- SQLite 对于当前并发完全够用

## 实现要点
1. 保持代码简洁
2. 复用现有组件和样式
3. 遵循项目目录结构
4. 添加基本错误处理
5. 实现基础测试

## 参考
- 现有 mock 实现：src/lib/mock-faq-data.ts
- 现有组件：src/components/faq/
- 现有页面：src/app/(customer)/faq/
- OpenSpec：openspec/specs/faq-system/