# OpenSpec

此目录只保留**仍然代表当前系统事实或长期约束**的 OpenSpec 内容。

## 从这里开始

1. 阅读 [`project.md`](./project.md) 了解项目上下文与长期约束
2. 查看 `specs/` 了解当前仍然保留的系统规格
3. 如果以后真的需要新的提案，再临时创建 `changes/<change-id>/`

## 当前目录原则

当前仓库不再长期保留大批 proposal、tasks、design 与 archive 树。这里现在只适合放两类内容：

- **当前规格**：仍然能描述今天系统行为或边界的 spec
- **长期约束**：短期内不会频繁变化、但值得保留的设计边界

如果某份 OpenSpec 材料只是一次性实施计划、已经漂移的提案，或纯历史归档，就不应继续保留在仓库里。

## 目录结构

```text
openspec/
├── project.md              # 项目上下文与长期约束
├── specs/                  # 当前仍然保留的系统规格
│   └── <spec-name>/
│       ├── spec.md
│       └── design.md       # 仅在确有长期价值时保留
└── AGENTS.md               # 精简后的 OpenSpec 使用规则
```

## 与 `docs/` 的边界

为避免重复与漂移，请明确分工：

- `docs/`：记录**当前已实现系统**的说明、导航、运维与开发参考
- `openspec/`：记录**仍值得长期保存的规格与约束**

如果某个主题已经完全可以由代码和 `docs/` 说明清楚，就不要再额外保留一套 proposal/history 文档。

## 使用规则

- **当前行为** → 先看 `specs/` 与当前代码
- **当前实现说明** → 优先写进 `docs/`
- **新的重大变更提案** → 仅在确有需要时再创建 `changes/<change-id>/`
- **已完成且无长期价值的提案** → 直接删除，不再默认归档

## 如何检查当前状态

```bash
# 查看项目上下文
cat openspec/project.md

# 查看当前规格
ls openspec/specs/

# 查看某个规格
cat openspec/specs/<spec-name>/spec.md
```

## 备注

- 不要在这里维护大量静态提案目录说明
- OpenSpec 现在是“精简保留”，不是历史资料仓库
- 如果当前事实与旧 OpenSpec 材料冲突，以代码和 `docs/` 为准