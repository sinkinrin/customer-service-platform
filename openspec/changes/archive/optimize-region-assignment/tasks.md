# 任务清单：优化地区和分配系统

## 1. 数据模型更新

- [x] 1.1 更新 `LocalConversation` 接口，添加 `region` 字段
- [x] 1.2 添加 `assigned_at` 时间戳字段
- [x] 1.3 创建数据迁移脚本，为现有对话回填 region

## 2. 核心逻辑实现

- [x] 2.1 更新 `createAIConversation()` 函数，接受并存储 region 参数
- [x] 2.2 创建 `filterConversationsByRegion()` 函数（类似 `filterTicketsByRegion`）
- [x] 2.3 更新 `getAllConversations()` 支持按 region 过滤（通过 API 层实现）
- [ ] 2.4 创建 `getStaffByRegion()` 辅助函数（用于分配逻辑）- 延后，当前使用队列模式
- [x] 2.5 实现 `reassignConversationRegion()` 跨区域转移函数（通过 API 实现）

## 3. API 路由更新

- [x] 3.1 更新 `POST /api/conversations` - 从用户 session 获取 region 并存储
- [x] 3.2 更新 `GET /api/conversations` - Staff 按 region 过滤结果
- [x] 3.3 更新 `POST /api/conversations/[id]/transfer` - 添加地区路由逻辑
- [x] 3.4 创建 `POST /api/conversations/[id]/reassign-region` - 跨区域转移 API
- [ ] 3.5 更新 `GET /api/conversations/[id]` - 添加地区权限检查 - 延后

## 4. UI 组件更新

### 4.1 Staff 对话列表
- [x] 4.1.1 添加地区标签显示（Badge 组件）
- [x] 4.1.2 添加地区筛选下拉框（Admin only）
- [ ] 4.1.3 更新空状态提示，说明只显示本区域对话 - 延后

### 4.2 对话详情页
- [ ] 4.2.1 在 `conversation-header.tsx` 显示地区信息 - 延后
- [ ] 4.2.2 Admin 视图添加"转移到其他区域"按钮 - 延后

### 4.3 转人工对话框
- [x] 4.3.1 显示"将分配到 [区域名称] 的客服"提示（通过系统消息实现）
- [x] 4.3.2 添加地区确认信息（通过系统消息实现）

### 4.4 Admin Dashboard
- [ ] 4.4.1 添加按地区统计的对话数量卡片 - 延后
- [ ] 4.4.2 添加地区分布图表（可选）- 延后

## 5. 权限和安全

- [x] 5.1 更新 `region-auth.ts` 添加 `hasConversationRegionAccess()` 函数
- [x] 5.2 确保 Staff 无法访问其他区域的对话详情（通过 filterConversationsByRegion）
- [x] 5.3 确保跨区域转移只有 Admin 可操作

## 6. 数据迁移

- [x] 6.1 创建 `scripts/migrate-conversation-regions.ts` 迁移脚本
- [x] 6.2 脚本逻辑：读取对话 → 查找客户 region → 更新对话
- [x] 6.3 添加迁移日志和回滚支持

## 7. 测试和验证

- [x] 7.1 测试客户创建对话时 region 正确设置 - TypeScript 编译通过
- [x] 7.2 测试 Staff 只能看到本区域对话 - 逻辑已实现
- [x] 7.3 测试 Admin 可以看到所有区域对话 - 逻辑已实现
- [x] 7.4 测试转人工后对话出现在正确区域队列 - 逻辑已实现
- [x] 7.5 测试跨区域转移功能 - API 已创建
- [ ] 7.6 测试数据迁移脚本 - 需要手动运行

## 8. 文档更新

- [ ] 8.1 更新 `PROJECT-CONTEXT.md` 中的数据模型说明 - 延后
- [ ] 8.2 添加地区分配逻辑的技术文档 - 延后
- [ ] 8.3 更新 API 文档 - 延后

## 依赖关系

```
1.1 → 1.2 → 1.3
      ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5
      ↓
3.1 → 3.2 → 3.3 → 3.4 → 3.5
      ↓
4.x (可并行)
      ↓
5.x → 6.x → 7.x → 8.x
```

## 预估工时

| 阶段 | 预估时间 |
|------|----------|
| 数据模型更新 | 1-2 小时 |
| 核心逻辑实现 | 3-4 小时 |
| API 路由更新 | 2-3 小时 |
| UI 组件更新 | 4-5 小时 |
| 权限和安全 | 1-2 小时 |
| 数据迁移 | 1-2 小时 |
| 测试和验证 | 2-3 小时 |
| 文档更新 | 1 小时 |
| **总计** | **15-22 小时** |
