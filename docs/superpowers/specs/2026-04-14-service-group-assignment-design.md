# Service Group Assignment 设计稿（历史提案）

> 状态：提案 / 未落地。
> 当前运行逻辑仍以 `CustomerStaffBinding` + binding-aware auto-assign 为核心。

## 这份文档的定位

这是一份**历史设计提案**，目标是把当前的 customer-staff binding 模型替换为由 Admin 手动维护的 **Service Group** 模型。

它记录的是一种未来可能的重构方向，而不是当前实现事实。

---

## 提案目标

提案希望把：

- 当前“客户首次建单后自动形成 1:1 staff 绑定”的模型

替换成：

- Admin 预先把客户分配到命名的服务小组（例如“亚太1”“中东2”）
- 每个小组映射到一个固定 staff
- ticket 路由优先根据 group assignment，而不再以 binding-first 为中心

提出这一方向的动机包括：

1. Admin 希望在客户首次建单前就决定服务归属
2. 现有 binding 的粒度不够灵活，不利于只迁移部分客户
3. 需要更显式的组织结构，而不只是平面 customer→staff 关系

---

## 提案中的关键设计

### Zammad 侧不新增复杂子组

提案明确倾向于：

- Zammad 继续保留现有 region groups
- Service Group 只存在于 Prisma / 平台侧
- 不依赖 Zammad 子组层级来承载业务分组

### 数据层改造方向

提案设想新增两类表：

- `ServiceGroup`
- `CustomerGroupAssignment`

用来替代当前的 `CustomerStaffBinding`。

### 未分组客户处理

提案中还设计了“未分配客户先进入 staging group，再由 Admin 后续指定”的流程。

---

## 为什么它仍然只是提案

当前代码事实并不是这套模型：

- 现有 schema 中存在的是 `CustomerStaffBinding`
- 当前自动分配逻辑仍在 `src/lib/ticket/auto-assign.ts`
- Admin 管理接口也是 `src/app/api/admin/customer-bindings/*`
- 代码里并没有与该提案对应的 `ServiceGroup` 运行时实现

所以这份文档只能当作“未来重构方向草案”。

---

## 当前应该参考什么

如果你在判断**现在系统如何工作**，请优先查看：

- `src/lib/ticket/auto-assign.ts`
- `src/lib/ticket/customer-binding.ts`
- `src/app/api/admin/customer-bindings/route.ts`
- `prisma/schema.prisma`
- `docs/ARCHITECTURE.md`
- `openspec/project.md`

不要把本文件当作当前运行真相。

---

## 保留这份文档的原因

保留它的价值主要是：

- 说明曾考虑过从 binding 模型演进到 service-group 模型
- 留存当时的业务动机与重构思路
- 为未来若重新启动这项变更时提供背景

如果未来决定正式实施，应在 OpenSpec 中重新建立新的 change proposal，并按当时的代码现实重新设计，而不是直接照搬本稿。
