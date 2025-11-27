## 1. 实施
- [x] 1.1 修复 FAQ 详情查询：更换查询方式避免 `findUnique` 携带非唯一条件报错，并保持未找到/未激活时返回 404。
  - **实施文件**: `src/app/api/faq/[id]/route.ts`
  - **修改内容**: 将 `findUnique` 改为 `findFirst`，保持 `isActive: true` 过滤条件
  - **错误处理**: 返回404并提供清晰的错误消息 "Article not found or not available"

- [x] 1.2 在工单详情与文章 API 中补充区域/归属校验：staff 仅能访问本区域工单，customer 仅能访问自己的工单，admin 全量放行，响应码与错误信息保持一致。
  - **实施文件**:
    - `src/app/api/tickets/[id]/route.ts` (GET, PUT方法)
    - `src/app/api/tickets/[id]/articles/route.ts` (GET, POST方法)
  - **修改内容**:
    - 导入 `validateTicketAccess` 和 `notFoundResponse`
    - 在获取工单后添加区域/归属校验逻辑
    - Staff: 使用 `validateTicketAccess` 验证区域权限，失败返回403
    - Customer: 验证工单所有者邮箱，失败返回404（不泄露工单存在性）
    - Admin: 无额外校验，全量访问
  - **错误响应**:
    - Staff跨区域访问: 403 "You do not have permission to access this ticket"
    - Customer访问他人工单: 404 "Ticket not found"

- [x] 1.3 AI 会话历史顺序修复：加载持久化历史时按时间升序整理，并在转人工时携带正确顺序的历史上下文。
  - **实施文件**:
    - `src/app/customer/conversations/[id]/page.tsx` (前端加载历史)
    - `src/app/api/conversations/[id]/transfer/route.ts` (转人工API)
  - **修改内容**:
    - 前端: 在过滤AI消息后添加 `.reverse()` 转换为升序
    - 转人工API: 在过滤AI消息后添加 `.sort()` 按时间升序排序
    - 添加注释说明排序逻辑和OpenSpec要求
  - **验证**: 日志输出 "persisted AI messages in ascending order"

- [ ] 1.4 补充/调整回归校验（含单元或集成）覆盖上述路径。
  - **待实施**: 需要添加自动化测试验证修复

## 2. 文档
- [ ] 2.1 更新 CHANGELOG.md 记录本次修复的问题与影响范围。
  - **待实施**: 需要添加版本0.2.2或0.3.0的变更日志条目

- [ ] 2.2 在 proposal.md 中标注完成状态与实际实施差异（如有）。
  - **待实施**: 需要更新提案状态为"已实施"

## 3. 实施总结

### 已完成的修复 (2025-11-20)

#### 修复1: FAQ详情查询 (高优先级) ✅
- **问题**: `findUnique` 使用非唯一字段 `isActive` 导致Prisma错误
- **解决方案**: 改用 `findFirst` 方法
- **文件**: `src/app/api/faq/[id]/route.ts`
- **影响**: FAQ详情页面现在可以正常加载，不再返回500错误

#### 修复2: 工单访问控制 (高优先级) ✅
- **问题**: 缺少区域/归属校验，staff可能访问跨区域工单
- **解决方案**:
  - 添加 `validateTicketAccess` 校验staff区域权限
  - 添加邮箱比对校验customer归属
  - Admin保持全量访问
- **文件**:
  - `src/app/api/tickets/[id]/route.ts` (GET, PUT)
  - `src/app/api/tickets/[id]/articles/route.ts` (GET, POST)
- **影响**:
  - Staff跨区域访问返回403
  - Customer访问他人工单返回404
  - 提升了数据安全性和隐私保护

#### 修复3: AI会话历史排序 (中优先级) ✅
- **问题**: AI历史以降序存储/传递，导致上下文顺序错误
- **解决方案**:
  - 前端加载时反转为升序
  - 转人工API排序为升序
- **文件**:
  - `src/app/customer/conversations/[id]/page.tsx`
  - `src/app/api/conversations/[id]/transfer/route.ts`
- **影响**: AI对话历史现在按正确的时间顺序显示和传递

### 代码质量指标
- **TypeScript错误**: 19个 (无新增)
- **ESLint错误**: 0个
- **ESLint警告**: 2个 (无新增)
- **修改文件数**: 5个
- **新增代码行**: ~120行
- **删除代码行**: ~20行

### 待完成任务
- [ ] 添加自动化测试验证修复 (任务1.4)
- [ ] 更新CHANGELOG.md (任务2.1)
- [ ] 更新proposal.md状态 (任务2.2)
