# 任务清单：邮件工单自动路由

## 1. 常量配置

### 1.1 新增暂存Group常量
- [x] 1.1.1 在 `src/lib/constants/regions.ts` 添加 `STAGING_GROUP_ID = 9`
- **预计时间**：0.1天
- **优先级**：P0

## 2. Webhook路由逻辑

### 2.1 新增路由函数
- [x] 2.1.1 添加 `handleEmailTicketRoutingFromWebhookPayload()`（`src/lib/ticket/email-ticket-routing.ts`）
- [x] 2.1.2 实现双重条件检查（group_id + article.type）
- [x] 2.1.3 实现客户Region解析（parseRegionFromNote）
- [x] 2.1.4 实现工单Group更新
- [x] 2.1.5 调用 `autoAssignSingleTicket()`，并在失败时执行 `handleAssignmentNotification()`
- **预计时间**：0.5天
- **优先级**：P0

### 2.2 Admin通知逻辑
- [x] 2.2.1 实现 `notifyAdminsAboutUnroutedTicket()` 函数
- [x] 2.2.2 获取所有活跃Admin用户（`role_id === ZAMMAD_ROLES.ADMIN`）
- [x] 2.2.3 发送系统通知（包含工单号、客户邮箱）
- **预计时间**：0.3天
- **优先级**：P0

### 2.3 集成到Webhook主流程
- [x] 2.3.1 在 `updateEvent === 'created'` 后调用路由函数
- [x] 2.3.2 确保非阻塞处理（try-catch包裹）
- [x] 2.3.3 添加日志记录
- **预计时间**：0.2天
- **优先级**：P0

## 3. 测试验证

### 3.1 功能测试
- [ ] 3.1.1 测试邮件工单（有Region）→ 自动路由 + 分配
- [ ] 3.1.2 测试邮件工单（无Region）→ 留在暂存 + Admin通知
- [ ] 3.1.3 测试Web工单（group_id=9）→ 跳过路由
- [ ] 3.1.4 测试重复Webhook → 跳过已路由工单
- **预计时间**：0.5天
- **优先级**：P1

### 3.2 错误场景测试
- [ ] 3.2.1 测试Zammad API失败 → 不阻塞Webhook
- [ ] 3.2.2 测试无效Region值 → 视为无Region
- [ ] 3.2.3 测试auto-assign失败 → 工单仍在正确Group
- **预计时间**：0.3天
- **优先级**：P1

## 4. Zammad配置验证

### 4.1 邮件通道配置
- [ ] 4.1.1 确认邮件默认进入暂存Group（ID: 9）
- [ ] 4.1.2 确认Webhook触发器配置正确
- **预计时间**：0.1天
- **优先级**：P0

---

## 总结

| 功能 | 开发量 |
|------|--------|
| 常量配置 | 0.1天 |
| 路由逻辑 | 1天 |
| 测试验证 | 0.8天 |
| Zammad配置 | 0.1天 |
| **总计** | **约 2天** |
