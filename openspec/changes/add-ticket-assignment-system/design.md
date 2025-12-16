# 设计文档：添加工单分配与员工假期管理

## 上下文

当前工单系统采用"队列模式"，员工自行认领工单。需要增加假期管理和手动分配功能。

> [!NOTE]
> **简化设计**：由于员工较少且在线状态不稳定，只实现**休假状态管理**，其他员工默认可分配。使用 Zammad 内置 Out-of-Office API。

### 利益相关者
- **客服人员（Staff）** - 需要设置假期状态
- **管理员（Admin）** - 需要分配和监控工单
- **客户** - 期望工单快速被响应

## 目标 / 非目标

### 目标
- 员工可设置假期时间范围和代理人
- 休假员工在分配时被排除或标记
- 管理员可手动分配和重新分配工单
- 分配时显示员工工作负载

### 非目标
- ~~在线/忙碌/离线状态管理~~（员工少，不实用）
- ~~自动分配算法~~（手动分配即可）
- 复杂的技能匹配路由

## Zammad Out-of-Office API

项目 `src/lib/zammad/types.ts` 已定义 `ZammadUser` 类型，包含：

```typescript
interface ZammadUser {
  out_of_office: boolean
  out_of_office_start_at: string | null
  out_of_office_end_at: string | null
  out_of_office_replacement_id: number | null
  // ...其他属性
}
```

**API 端点**：`PUT /api/v1/users/{user_id}`

**请求体示例**：
```json
{
  "out_of_office": true,
  "out_of_office_start_at": "2024-12-20",
  "out_of_office_end_at": "2024-12-27",
  "out_of_office_replacement_id": 123
}
```

## 实现方案

| 功能 | 实现方式 | 说明 |
|------|---------|------|
| 假期状态设置 | Zammad Out-of-Office API | 已有类型定义 |
| 假期自动生效 | Zammad 内置 | 无需开发 |
| 工单转给代理人 | Zammad 内置 | 通过 replacement_id |
| 手动分配 | Zammad API | 更新 ticket.owner_id |
| 负载显示 | API 统计 | 统计未关闭工单数 |

## 决策

### 决策：只使用休假状态
- **选择**：只实现休假状态（out_of_office），不实现在线/忙碌/离线
- **原因**：
  - 员工较少，在线状态不稳定
  - 只有明确休假才排除，其他默认可分配
  - 利用 Zammad 内置功能，无需额外开发

### 决策：分配方式
- **选择**：手动分配为主
- **方案**：
  1. 管理员打开分配弹窗
  2. 查看可用员工和工单负载
  3. 选择员工分配
- **原因**：
  - 员工少，手动分配够用
  - 避免复杂的自动分配逻辑

### 决策：员工列表排序
- **选择**：按工单数从少到多排序，休假员工排最后
- **原因**：方便管理员快速选择负载低的员工

## API 设计

### 假期管理 API
```
GET    /api/staff/vacation     - 获取当前用户假期状态
PUT    /api/staff/vacation     - 设置假期（调用 Zammad）
DELETE /api/staff/vacation     - 取消假期
```

### 可分配员工 API
```
GET    /api/staff/available    - 获取可分配员工列表（含工单数）
```

### 工单分配 API
```
PUT    /api/tickets/[id]/assign   - 分配给指定员工
DELETE /api/tickets/[id]/assign   - 取消分配
```

## 风险 / 权衡

### 风险：没有自动分配
- **缓解措施**：工单未分配时进入队列，员工可自行认领
- **缓解措施**：管理员定期查看未分配工单

### 风险：代理人也休假
- **缓解措施**：设置代理人时检查其假期状态
- **缓解措施**：API返回警告提示

## 开放问题

1. 是否需要批量分配功能？
2. 假期设置是否需要审批流程？
