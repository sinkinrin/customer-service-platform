# OpenSpec 指令

此仓库中的 OpenSpec 已切换为**精简保留模式**。

## 核心原则

- `docs/` 负责记录**当前实现事实**、运维说明和审计记录
- `openspec/` 只保留**仍有长期价值的当前规格与约束**
- 一次性 proposal、过时 tasks、历史归档和实施中间产物默认**直接删除**，不再持续累计 archive 树

## 使用前先判断

只有在下面情况之一成立时，才值得新增或修改 OpenSpec：

- 需要记录一个会长期影响系统判断的当前规格
- 需要沉淀一个跨模块、短期内不会失效的长期约束
- 需要为未来仍会反复参考的能力保留验收语义

以下情况通常**不需要**继续写 OpenSpec：

- 临时执行计划
- 已完成且不会再复用的 proposal / tasks
- 仅靠代码和 `docs/` 就能说清楚的实现细节
- 纯历史材料

## 当前工作方式

1. 先读 `openspec/project.md`
2. 再看 `openspec/specs/` 中是否已有对应规格
3. 如果只是更新当前事实，优先改 `docs/`
4. 如果确实需要保留规格，再改 `openspec/specs/<spec-name>/spec.md`
5. 如果某个旧 spec / 旧提案已经没有长期价值，直接删除

## 推荐目录结构

```text
openspec/
├── project.md
├── specs/
│   └── <spec-name>/
│       ├── spec.md
│       └── design.md   # 仅在确有长期价值时保留
└── AGENTS.md
```

## 写作要求

- 规格只写**今天仍然成立**的行为或约束
- 每条 Requirement 至少保留一个清晰 Scenario
- 不要把大段实施步骤、执行 checklist、归档说明继续留在这里
- 如果某条内容更适合放在 `docs/`，就不要硬塞进 OpenSpec

## 删除规则

满足以下任一条件即可删除：

- 已经被当前代码和 `docs/` 完全覆盖
- 只是一次性计划或历史提案
- 内容明显漂移、继续保留只会误导后续维护
- 仅为 archive 而 archive，没有现实参考价值

## 判断优先级

当 `openspec/`、`docs/` 与代码冲突时：

1. 先信代码
2. 再更新 `docs/`
3. 仅在确有长期价值时同步更新 `openspec/`