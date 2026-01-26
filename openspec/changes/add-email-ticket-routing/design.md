# 设计文档：邮件工单自动路由

## 上下文

当前邮件工单流程：
1. 客户发送邮件到 support@howentech.com
2. Zammad接收邮件，创建工单进入暂存Group（ID: 9）
3. Admin手动检查客户区域，移动到正确Group
4. 再手动分配给Staff

需要自动化步骤3和4。

### 利益相关者
- **客户** - 期望工单快速被响应
- **Staff** - 期望工单自动分配到自己负责的区域
- **Admin** - 期望减少手动路由工作

## 目标 / 非目标

### 目标
- 邮件工单根据客户Region自动路由到对应Group
- 路由成功后自动分配给可用Staff
- 无法路由时通知Admin处理

### 非目标
- ~~邮箱域名推断区域~~（后续可扩展）
- ~~Organization关联区域~~（后续可扩展）
- ~~多邮箱分别路由~~（当前只有一个support邮箱）

## 实现方案

### 触发条件（双重验证）

| 条件 | 说明 |
|------|------|
| `group_id === 9` | 工单在暂存Group |
| `article.type === 'email'` | 首条消息是邮件类型 |

同时满足才触发路由，避免处理Web创建的工单。

### Region解析

从客户`note`字段解析，格式：`Region: <region-value>`

```typescript
function parseRegionFromNote(note?: string): RegionValue | undefined {
  if (!note) return undefined
  const match = note.match(/Region:\s*(\S+)/)
  return match?.[1] as RegionValue | undefined
}
```

有效Region值：
- `asia-pacific` → Group 4
- `middle-east` → Group 3
- `africa` → Group 1
- `north-america` → Group 6
- `latin-america` → Group 7
- `europe-zone-1` → Group 2
- `europe-zone-2` → Group 8
- `cis` → Group 5

### 路由逻辑

```
Webhook收到created事件
    │
    ├── 检查 group_id === 9?
    │   └── No → 跳过（非暂存Group）
    │
    ├── 检查 article.type === 'email'?
    │   └── No → 跳过（非邮件工单）
    │
    ├── 获取客户信息，解析Region
    │
    ├── Region存在?
    │   ├── Yes → 更新工单group_id → 触发auto-assign
    │   └── No  → 通知Admin
    │
    └── 返回（不阻塞Webhook响应）
```

## 决策

### 决策：在Webhook中实现路由
- **选择**：在现有Webhook处理流程中增加路由逻辑
- **备选**：独立API + 定时任务
- **原因**：
  - 改动集中，复用现有代码
  - 实时处理，无延迟
  - 无需新增API端点

### 决策：非阻塞处理
- **选择**：路由失败不阻塞Webhook返回
- **原因**：
  - 避免Zammad重试
  - 错误记录日志，不影响其他工单
  - 最坏情况：工单留在暂存Group，Admin手动处理

### 决策：双重条件验证
- **选择**：`group_id === 9` 且 `article.type === 'email'`
- **原因**：
  - 避免误处理Web创建的工单
  - 即使有人在Web选择暂存Group也不会触发
  - 更精确的邮件工单识别

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| Zammad API调用失败 | 记录错误日志，不阻塞webhook返回 |
| 客户不存在 | 跳过路由，记录warning |
| Region格式无效 | 视为无Region，通知Admin |
| 自动分配失败 | 记录错误，工单已在正确Group，不回滚 |
| 重复webhook | 检查group_id已变更则跳过 |

## 风险 / 权衡

### 风险：新邮件用户无Region
- **说明**：首次发邮件的客户，Zammad自动创建用户，note为空
- **缓解**：通知Admin，Admin设置客户Region后手动路由
- **后续**：可扩展邮箱域名推断功能

### 风险：Webhook处理时间增加
- **说明**：增加API调用（获取用户、更新工单、自动分配）
- **缓解**：非阻塞处理，不影响Webhook响应
- **监控**：记录处理时间日志

## 测试场景

| 场景 | 预期结果 |
|------|----------|
| 邮件工单，客户有Region | 路由到目标Group + 自动分配 |
| 邮件工单，客户无Region | 留在暂存Group + Admin收到通知 |
| Web创建工单（group_id=9） | 跳过路由（article.type不是email） |
| 邮件工单但已在区域Group | 跳过路由（group_id≠9） |
| 同一工单重复webhook | 第二次跳过（group_id已变更） |
