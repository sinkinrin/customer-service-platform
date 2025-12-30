# TODO未实现功能清单

> 扫描日期: 2025-12-23
> 扫描范围: src目录下所有代码文件

---

## 🔴 P0 - 影响核心功能

### 1. 工单附件上传
- **文件**: `src/app/customer/my-tickets/create/page.tsx:89-90`
- **问题**: 客户创建工单时选择的文件从未发送到API
- **代码**:
  ```typescript
  // TODO: Handle file attachments
  // Zammad API supports attachments, but we need to implement file upload
  ```
- **影响**: 用户反馈#17 - 客户提交工单上传的附件无法送到技术支持界面

---

## 🟡 P1 - 影响用户体验

### 2. 工单导出功能
- **文件**: `src/app/admin/tickets/page.tsx:104`
- **问题**: Export按钮只是console.log，没有实际导出功能
- **代码**:
  ```typescript
  const exportTickets = () => {
    // TODO: Implement CSV export
    console.log('Exporting tickets...', filteredTickets)
  }
  ```
- **影响**: 用户反馈#35 - admin账号下需要可以下载全部的TICKET

### 3. 用户注册API
- **文件**: `src/lib/hooks/use-auth.ts:141`
- **问题**: 注册功能只是尝试登录，没有实际创建用户
- **代码**:
  ```typescript
  // TODO: Implement actual user registration API
  // For now, just attempt to sign in (works with mock users)
  ```

### 4. 密码重置/更新
- **文件**: `src/lib/hooks/use-auth.ts:197, 209`
- **问题**: 密码重置和更新功能未实现
- **代码**:
  ```typescript
  // TODO: Implement password reset API
  // TODO: Implement password update API
  ```

---

## 🟢 P2 - 技术债务/后续优化

### 5. Zammad Webhook处理
- **文件**: `src/app/api/webhooks/zammad/route.ts:6-9`
- **问题**: Webhook接收但未处理实时更新
- **代码**:
  ```typescript
  // TODO: Implement webhook processing logic
  // - Store webhook events for real-time updates
  // - Trigger WebSocket notifications to connected clients
  // - Update conversation/ticket state in real-time
  ```

### 6. 文件存储系统
- **文件**: `src/app/api/files/upload/route.ts:45`
- **问题**: 使用本地文件存储，生产环境需要云存储
- **代码**:
  ```typescript
  // TODO: Replace with real file storage when implemented
  ```

### 7. Session管理
- **文件**: `src/app/api/sessions/route.ts:6, 40` 和 `src/app/api/sessions/[id]/route.ts:7, 29, 62`
- **问题**: 使用Mock session数据
- **代码**:
  ```typescript
  // TODO: Replace with real session management system
  // TODO: Replace with real database query
  // TODO: Replace with real session deletion
  ```

### 8. 业务类型管理
- **文件**: `src/app/api/admin/settings/route.ts:29`
- **问题**: businessTypes返回空数组
- **代码**:
  ```typescript
  businessTypes: [], // TODO: Implement business types management
  ```
- **影响**: 用户反馈#42 - BUSINESS TYPE暂时没有这个功能，先屏蔽

### 9. 认证系统
- **文件**: `src/lib/mock-auth.ts:5` 和 `src/lib/stores/auth-store.ts:7`
- **问题**: 仍有Mock认证相关代码
- **代码**:
  ```typescript
  // TODO: Replace mock types with real authentication types
  // TODO: Replace with real authentication system
  ```

### 10. 开发环境自动登录
- **文件**: `src/app/api/dev/auto-login/route.ts:15`
- **问题**: 开发环境特殊处理
- **代码**:
  ```typescript
  // TODO: Replace with real authentication when implemented
  ```

---

## 📊 统计

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | 1 | 影响核心功能，需立即修复 |
| P1 | 4 | 影响用户体验，需优先处理 |
| P2 | 6 | 技术债务，可计划处理 |

---

## 建议处理顺序

1. **立即修复**: 工单附件上传 (#1)
2. **本周完成**: 工单导出功能 (#2)
3. **下周计划**: 用户注册/密码重置 (#3, #4)
4. **后续迭代**: Webhook处理、云存储迁移等
