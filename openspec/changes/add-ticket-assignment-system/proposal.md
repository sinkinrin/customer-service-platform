# 变更：添加工单分配与员工假期管理

## 原因

当前工单系统缺乏分配机制和假期管理，主要问题：

1. **无假期状态管理** - 员工请假时仍可能被分配工单
2. **手动分配效率低** - 管理员需要手动查看和分配工单
3. **缺乏负载信息** - 不知道哪个员工更空闲

## 变更内容

> [!NOTE]
> **简化设计**：由于员工较少且在线状态不稳定，只实现**休假状态管理**，其他员工默认可分配。使用 Zammad 内置 Out-of-Office API。

### 阶段1：假期状态管理（P0）
- 封装 Zammad Out-of-Office API
- 创建假期设置前端 UI
- Staff 可设置假期时间范围和代理人

### 阶段2：手动分配功能（P1）
- 管理员可手动分配工单
- 分配时显示员工工单负载
- 休假员工在列表中标记

## 影响

### 受影响的代码

**Zammad API 封装**：
- `src/lib/zammad/client.ts` - 添加 Out-of-Office 方法

**假期 UI**：
- `src/app/staff/settings/page.tsx` - 添加假期设置
- `src/components/staff/vacation-dialog.tsx` - 假期设置弹窗

**分配功能**：
- `src/app/api/tickets/[id]/assign/route.ts` - 分配 API
- `src/app/api/staff/available/route.ts` - 可分配员工
- `src/components/admin/ticket-assign-dialog.tsx` - 分配弹窗

### 破坏性变更
- **无**

## 优先级

**整体优先级**：🔴 P0（紧急）

## 预期收益

1. **假期无忧** - 员工休假时不会被分配工单
2. **分配清晰** - 管理员可看到员工负载
3. **快速实现** - 利用 Zammad API，开发量约6天
