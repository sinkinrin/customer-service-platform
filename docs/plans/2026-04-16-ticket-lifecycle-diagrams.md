# 工单生命周期结构重构：可用性可视化

本文档提炼自 `2026-04-16-ticket-lifecycle-note-region-refactor-design.md`，使用 Mermaid 流程图直观展示了由于业务归属（`Region`）逻辑带来的旧有实现与目标架构的对比。

---

## 1. 当前真实全景图 (Current Architecture)

旧系统中，用户所属的业务区域严重依赖文本解析，这在 Web 和 Email 等端上产生了多个割裂的查询逻辑分叉。

```mermaid
graph TD
    %% 客户登录逻辑
    subgraph Login [1. 客户登录 Login]
        L1[Zammad Auth] -->|登录系统| L2[auth.ts]
        L2 -->|文本解析缺陷| L3[Region = parse note.Region]
        L3 --> L4((业务会话 Session<br>with parsed region))
    end

    %% Web 建单逻辑
    subgraph Web [2. Web 端工单创建]
        W1[POST /api/tickets] --> W2[Resolve region from ticketData or user]
        W2 --> W3[Region -> group_id]
        W3 --> W4[Create Zammad ticket directly in regional group]
        W4 --> W5[autoAssignSingleTicket 自动派单]
        W5 --> W6{优先匹配 Binding}
        W6 -->|存在绑定且在线| W7[指定工单负责 Staff]
        W6 -->|无绑定/休假| W8[组内负载均衡 Load Balance]
    end

    %% Email 建单逻辑
    subgraph Email [3. Email 端工单创建]
        E1[Zammad 默认建立在 Staging Group 9] --> E2[Webhook 触发]
        E2 --> E3[email-ticket-routing]
        E3 --> E4[Fetch Customer note]
        E4 --> E5[Parse note.Region]
        E5 -->|如果有效| E6[将工单转移到区域组 Regional Group]
        E6 --> W5
        E5 -.->|欢迎邮件风险| E7[误判为首次 Email 用户]
    end

    %% 工单对话逻辑
    subgraph Conversation [4. 工单对话]
        C1[GET/POST ticket articles] --> C2[Zammad Base Articles]
        C2 --> C3[Webhook -> Ticket Update 日志]
        C3 --> C4((SSE / Polling 状态更新))
    end
    
    style L3 fill:#ffcccc,stroke:#ff0000,stroke-width:2px,stroke-dasharray: 5, 5
    style E5 fill:#ffcccc,stroke:#ff0000,stroke-width:2px,stroke-dasharray: 5, 5
    style E7 fill:#ffe6e6,stroke:#ff9999
```

---

## 2. 目标系统全景图 (Target Architecture)

废弃对 `note.region` 文本的强依赖之后，所有的入口（终端）将统一查询本地数据库的新建派定关系 `CustomerGroupAssignment`。

```mermaid
graph TD
    %% 统一数据源真理
    DB[(本地主事实库<br>CustomerGroupAssignment)]
    style DB fill:#e6f3ff,stroke:#0066cc,stroke-width:3px

    %% 登录逻辑
    subgraph Login [1. 客户登录 Login]
        L1[Zammad Auth] --> L2[auth.ts 处理会话]
        L2 -->|统一查询归属| DB
        DB -.->|获取 ServiceGroup| L3((业务会话 Session:<br>组 ID & baseRegion))
    end

    %% Web 建单
    subgraph Web [2. Web 端工单创建]
        W1[POST /api/tickets] --> W2[Query CustomerGroupAssignment]
        W2 -->|读数据分配| DB
        DB -.->|提供 baseRegion & staffZammadId| W3{检查该客户是否已指定分组?}
        W3 -->|Yes & 负责人在线| W4[在区域组直接建工单 <br> + Assign to Staff]
        W3 -->|No / 负责人离线| W5[建立在 Staging Group 9 <br> + Notify Admin]
    end

    %% 邮件建单
    subgraph Email [3. Email 端工单创建]
        E1[Zammad 默认建立在 Staging Group 9] --> E2[Webhook email-ticket-routing]
        E2 --> E3[Query CustomerGroupAssignment]
        E3 -->|读数据分配| DB
        DB -.->|提供 baseRegion & staffZammadId| E4{检查该客户是否已指定分组?}
        E4 -->|Yes & 负责人在线| E5[转移至对应区域组 Regional Group <br> + Assign to Staff]
        E4 -->|No / 负责人离线| E6[停留在 Staging Group 9 <br> + Notify Admin]
    end
```
