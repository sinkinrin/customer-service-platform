# 变更：邮件工单自动路由

## Why

当前所有邮件工单进入同一个暂存Group（ID: 9），需要Admin手动分配到各区域。主要问题：

1. **人工路由效率低** - Admin需要逐个检查客户区域并移动工单
2. **响应延迟** - 工单在暂存区等待期间无人处理
3. **遗漏风险** - 暂存区工单可能被忽视

## What Changes

在Zammad Webhook处理流程中增加邮件工单自动路由逻辑：

### 核心功能
- 检测邮件创建的工单（`group_id === 9` 且 `article.type === 'email'`）
- 根据客户note中的Region自动路由到对应区域Group
- 路由成功后触发auto-assign自动分配给可用Staff
- 无法路由时（客户无Region）通知Admin手动处理

### 流程图

```
邮件 → 暂存Group(9) → Webhook → 检查Region
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                       有Region            无Region
                          │                   │
                          ▼                   ▼
                    路由到目标Group      留在暂存Group
                          │              通知Admin
                          ▼
                    触发auto-assign
```

## 影响

### 受影响的代码

**Webhook处理**：
- `src/app/api/webhooks/zammad/route.ts` - 增加路由逻辑

**常量配置**：
- `src/lib/constants/regions.ts` - 新增 `STAGING_GROUP_ID`

### 依赖的现有模块
- `zammadClient.getUser()` - 获取客户信息
- `zammadClient.updateTicket()` - 修改工单Group
- `getGroupIdByRegion()` - Region转Group ID
- `notifySystemAlert()` - 通知Admin
- `autoAssignSingleTicket()` - 自动分配
- `handleAssignmentNotification()` - 自动分配通知（失败通知Admin）

### 破坏性变更
- **无**

## 优先级

**整体优先级**：🟡 P1（重要）

## 预期收益

1. **自动化路由** - 有Region的邮件工单自动进入正确区域
2. **减少延迟** - 工单立即分配给可用Staff
3. **降低遗漏** - Admin只需关注无法自动路由的工单
