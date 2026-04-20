# 工单分配系统规格（归档摘要）

## 状态
已归档，保留最小摘要。

## 为什么保留
这项归档记录了平台早期工单分配体系的目标和边界，是当前分配系统历史演进的起点之一。

## 当前结论
当前系统已经不是这份早期规格描述的原始状态，而是演进为：

- `CustomerStaffBinding`
- binding-aware auto-assign
- 假期回退 / 替补处理
- Admin binding 管理接口

## 当前应参考
- `src/lib/ticket/auto-assign.ts`
- `src/lib/ticket/customer-binding.ts`
- `src/app/api/admin/customer-bindings/route.ts`
- `openspec/project.md`
- `docs/ARCHITECTURE.md`

这份归档仅保留“分配系统从哪里开始演化”的历史价值。
