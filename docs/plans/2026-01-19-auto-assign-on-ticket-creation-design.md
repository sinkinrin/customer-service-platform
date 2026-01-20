# Auto-Assign on Ticket Creation Design

## Overview

Customer 创建工单后，系统自动将工单分配给对应区域负载最低的可用 Staff。

## 决策记录

| 问题 | 决策 |
|------|------|
| 触发时机 | 同步分配（在 API 响应前完成） |
| 分配失败处理 | 工单创建成功，保持未分配，通知 Admin |
| 成功通知 | 通知被分配的 Staff |
| 失败通知 | 通知所有 Admin |
| 状态变更 | 分配时自动将 state_id 从 1(new) 改为 2(open) |

## 修改范围

```
src/
├── lib/
│   └── ticket/
│       └── auto-assign.ts  ← 新建：抽取自动分配核心逻辑
└── app/api/tickets/
    ├── route.ts            ← 修改：创建后调用自动分配
    └── auto-assign/
        └── route.ts        ← 修改：复用抽取的核心逻辑
```

## 核心逻辑

### 新建 `src/lib/ticket/auto-assign.ts`

```typescript
import { zammadClient } from '@/lib/zammad/client'
import { GROUP_REGION_MAPPING } from '@/lib/constants/regions'
import {
  notifyTicketAssigned,
  notifySystemAlert,
  resolveLocalUserIdsForZammadUserId,
} from '@/lib/notification'
import { prisma } from '@/lib/prisma'

// 排除的系统账户
const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

// 单工单自动分配结果
export interface SingleAssignResult {
  success: boolean
  assignedTo?: {
    id: number
    name: string
    email: string
  }
  error?: string
}

/**
 * 自动分配单个工单给对应区域的可用 Staff
 */
export async function autoAssignSingleTicket(
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  groupId: number
): Promise<SingleAssignResult> {
  try {
    // 1. 获取所有活跃 Agent
    const allAgents = await zammadClient.getAgents(true)

    // 2. 获取所有工单用于计算负载
    const allTickets = await zammadClient.getAllTickets()

    // 3. 计算每个 Agent 的当前工单数
    const ticketCountByAgent: Record<number, number> = {}
    for (const ticket of allTickets) {
      if (ticket.owner_id && ticket.owner_id !== 1 && [1, 2, 3, 7].includes(ticket.state_id)) {
        ticketCountByAgent[ticket.owner_id] = (ticketCountByAgent[ticket.owner_id] || 0) + 1
      }
    }

    const now = new Date()

    // 4. 筛选可用 Agent
    const availableAgents = allAgents.filter(agent => {
      // 排除系统账户
      if (EXCLUDED_EMAILS.some(email => agent.email?.toLowerCase() === email.toLowerCase())) {
        return false
      }

      // 排除 Admin 角色
      if (agent.role_ids?.includes(1)) {
        return false
      }

      // 检查是否有该 group 的访问权限
      const agentGroupIds = agent.group_ids || {}
      const hasGroupAccess = Object.keys(agentGroupIds).includes(String(groupId))
      if (!hasGroupAccess) {
        return false
      }

      // 检查是否休假中
      if (agent.out_of_office) {
        const startDate = agent.out_of_office_start_at ? new Date(agent.out_of_office_start_at) : null
        const endDate = agent.out_of_office_end_at ? new Date(agent.out_of_office_end_at) : null

        if (startDate && endDate) {
          if (now >= startDate && now <= endDate) return false
        } else if (startDate && !endDate) {
          if (now >= startDate) return false
        } else if (!startDate && endDate) {
          if (now <= endDate) return false
        }
      }

      return true
    })

    // 5. 无可用 Agent
    if (availableAgents.length === 0) {
      const region = GROUP_REGION_MAPPING[groupId] || 'unknown'
      return {
        success: false,
        error: `No available agents for region: ${region}`,
      }
    }

    // 6. 按负载排序，选择工单最少的
    availableAgents.sort((a, b) => {
      const loadA = ticketCountByAgent[a.id] || 0
      const loadB = ticketCountByAgent[b.id] || 0
      return loadA - loadB
    })

    const selectedAgent = availableAgents[0]

    // 7. 执行分配（同时更新状态为 open）
    await zammadClient.updateTicket(ticketId, {
      owner_id: selectedAgent.id,
      state_id: 2, // new -> open
    })

    const agentName = selectedAgent.firstname && selectedAgent.lastname
      ? `${selectedAgent.firstname} ${selectedAgent.lastname}`.trim()
      : selectedAgent.login || selectedAgent.email

    return {
      success: true,
      assignedTo: {
        id: selectedAgent.id,
        name: agentName,
        email: selectedAgent.email,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auto-assignment failed',
    }
  }
}

/**
 * 处理分配结果的通知
 */
export async function handleAssignmentNotification(
  result: SingleAssignResult,
  ticketId: number,
  ticketNumber: string,
  ticketTitle: string,
  region: string
): Promise<void> {
  try {
    if (result.success && result.assignedTo) {
      // 分配成功 → 通知 Staff
      const staffLocalIds = await resolveLocalUserIdsForZammadUserId(result.assignedTo.id)
      for (const recipientUserId of staffLocalIds) {
        await notifyTicketAssigned({
          recipientUserId,
          ticketId,
          ticketNumber,
          ticketTitle,
        })
      }
    } else {
      // 分配失败 → 通知所有 Admin
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true },
      })

      for (const admin of adminUsers) {
        await notifySystemAlert({
          recipientUserId: admin.id,
          title: 'Auto-assignment failed',
          body: `Ticket #${ticketNumber} could not be assigned: ${result.error}`,
          data: {
            ticketId,
            ticketNumber,
            ticketTitle,
            region,
            error: result.error,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Auto-Assign] Failed to send notification:', error)
  }
}
```

## 集成到 `POST /api/tickets`

在 `src/app/api/tickets/route.ts` 第 587 行（工单创建成功后）添加：

```typescript
import { autoAssignSingleTicket, handleAssignmentNotification } from '@/lib/ticket/auto-assign'

// ... 创建工单后 ...

// 自动分配给对应区域的 Staff
const assignResult = await autoAssignSingleTicket(
  ticket.id,
  ticket.number,
  ticket.title,
  groupId
)

if (assignResult.success) {
  console.log(`[Auto-Assign] Ticket #${ticket.number} assigned to ${assignResult.assignedTo?.name}`)
} else {
  console.warn(`[Auto-Assign] Failed for #${ticket.number}: ${assignResult.error}`)
}

// 发送通知（不阻塞响应）
handleAssignmentNotification(
  assignResult,
  ticket.id,
  ticket.number,
  ticket.title,
  region
).catch(err => console.error('[Auto-Assign] Notification error:', err))
```

## 错误处理

| 场景 | 处理方式 | 工单状态 |
|------|---------|---------|
| 无可用 Agent | 创建成功，通知 Admin | `state_id=1`, `owner_id=null` |
| Zammad API 超时 | 创建成功，通知 Admin | `state_id=1`, `owner_id=null` |
| 通知发送失败 | 仅记录日志，不影响响应 | 正常 |

## 性能影响

- 增加约 300-500ms 响应时间
- 主要开销：`getAgents()` + `getAllTickets()` + `updateTicket()`

## 后续优化（可选）

- 缓存 Agent 列表（TTL 1分钟）
- 缓存工单计数（实时更新）
- 使用数据库存储 Agent 负载，避免每次查询
