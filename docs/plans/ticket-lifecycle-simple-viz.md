# 工单生命周期架构重构：对比可视化

这里直接展示重构前后的逻辑流对比，无需任何复杂的交互代码，直接预览即可。

## 1. 当前老旧架构 (有风险)
主要风险点在于依赖 `note.Region` 字符串解析，逻辑极其脆弱。

```mermaid
graph TD
    subgraph Login [1. 登录]
        L1[Zammad Auth] -->|解析| L2{note.Region}
        L2 -->|提取成功| L3((Session with Region))
        L2 -->|提取失败| L4((Session without Region))
    end

    subgraph Channel [2. 多端建单]
        W1[Web 端] -->|依赖 note.Region| W2[区域组]
        E1[Email 端] -->|Webhook 解析 note| E2[转移至区域组]
    end

    style L2 fill:#ffcccc,stroke:#ff0000
    style E2 fill:#ffcccc,stroke:#ff0000
```

---

## 2. 目标重构架构 (稳健)
统一使用 `CustomerGroupAssignment` 数据库记录作为唯一的事实来源。

```mermaid
graph TD
    DB[(本地主事实库: CustomerGroupAssignment)]
    style DB fill:#e6f3ff,stroke:#0066cc,stroke-width:3px

    subgraph Unity [统一路由逻辑]
        In[流量入口: Login/Web/Email] --> Query[查询 Assignment 记录]
        Query --> DB
        DB --> Judge{匹配? <br> 是否在线?}
        
        Judge -->|YES| Success[区域组建单 + 分配负责人]
        Judge -->|NO| Staging[进入 Staging Group 9 兜底]
    end
```

### 重构核心变动：
1. **去中心化 -> 归口管理**：所有从 `note.Region` 拿数据的逻辑全部废弃。
2. **引入 Staging**：无法自动归类的工单统一进入 Group 9，由管理员处理，彻底解决“空区域”报错。
3. **精准到人**：以前只能分到组，现在支持直接通过数据库绑定 Staff ID。
