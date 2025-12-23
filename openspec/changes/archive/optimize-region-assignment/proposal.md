# 变更：全面优化地区和分配系统

## 原因

当前平台的地区（Region）和分配（Assignment）系统存在多个关键问题：

1. **对话缺少地区字段**：`LocalConversation` 没有 `region` 字段，导致无法按地区路由对话
2. **转人工无地区路由**：客户转人工时，系统不会根据客户地区分配给对应区域的客服
3. **客服队列无地区过滤**：Staff 看到的对话列表没有按地区过滤，可能看到其他区域的对话
4. **工单与对话地区不一致**：工单有 `group_id` 基于地区，但对话没有对应机制
5. **UI 缺少地区显示**：客服界面没有清晰显示对话/工单所属地区
6. **Zammad Group 映射不完整**：Africa 和 Europe Zone 2 没有专属 Group

## 变更内容

### 数据模型变更
- **BREAKING**: 为 `LocalConversation` 添加 `region` 字段
- 为对话添加 `assigned_at` 时间戳字段
- 添加分配历史记录支持

### 业务逻辑变更
- 创建对话时自动继承客户的 region
- 转人工时根据 region 路由到对应区域的客服队列
- Staff 只能看到自己区域的待处理对话（Admin 可看全部）
- 添加跨区域转移对话功能（需要权限）

### UI/UX 变更
- Staff 对话列表显示地区标签
- Admin Dashboard 添加按地区统计
- 转人工对话框显示将分配到的区域
- 添加地区筛选器到 Staff 对话列表

### API 变更
- `POST /api/conversations` - 自动设置 region
- `POST /api/conversations/[id]/transfer` - 基于 region 路由
- `GET /api/conversations` - Staff 按 region 过滤
- 新增 `POST /api/conversations/[id]/reassign-region` - 跨区域转移

## 影响

### 受影响的规范
- conversation-system (新建)
- region-system (新建)

### 受影响的代码

**核心文件：**
- `src/lib/local-conversation-storage.ts` - 添加 region 字段
- `src/lib/utils/region-auth.ts` - 添加对话地区权限检查
- `src/lib/constants/regions.ts` - 可能需要扩展

**API 路由：**
- `src/app/api/conversations/route.ts` - 创建时设置 region
- `src/app/api/conversations/[id]/transfer/route.ts` - 地区路由逻辑
- `src/app/api/conversations/[id]/route.ts` - 地区权限检查

**UI 组件：**
- `src/app/staff/conversations/page.tsx` - 地区过滤和显示
- `src/components/conversation/transfer-dialog.tsx` - 显示目标区域
- `src/components/conversation/conversation-header.tsx` - 显示地区标签
- `src/app/admin/dashboard/page.tsx` - 地区统计

### 破坏性变更
- **BREAKING**: 现有对话数据需要迁移，添加 region 字段（可基于 customer_email 查找用户 region）

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 现有对话数据缺少 region | 中 | 提供数据迁移脚本，基于客户信息回填 |
| Staff 看不到跨区域对话 | 低 | Admin 可手动重新分配 |
| 性能影响 | 低 | region 过滤在内存中进行，数据量小 |

## 成功标准

1. 客户转人工后，对话自动出现在对应区域 Staff 的队列中
2. Staff 只能看到自己区域的对话（Admin 除外）
3. UI 清晰显示每个对话/工单的所属区域
4. 支持 Admin 跨区域重新分配对话
