# OpenSpec

此目录用于管理当前规格、变更提案与设计决策。

## 从这里开始

1. 阅读 [`project.md`](./project.md) 了解当前项目上下文与长期约束
2. 查看 `specs/` 了解当前已建立的系统规格
3. 查看 `changes/` 了解待实施或讨论中的变更提案
4. 在变更完成后，将提案归档到 `changes/archive/`

> `PROJECT-CONTEXT.md` 仍然保留，但仅作为兼容入口，供旧提案和历史文档跳转使用；维护中的项目上下文以 `project.md` 为准。

## 目录结构

```text
openspec/
├── project.md              # 项目上下文与长期约束（维护中的入口）
├── PROJECT-CONTEXT.md      # 兼容旧链接的上下文入口
├── specs/                  # 当前系统规格
│   └── <spec-name>/
│       ├── spec.md
│       └── design.md
├── changes/                # 提议中的或待归档的变更
│   ├── <change-id>/
│   │   ├── proposal.md
│   │   ├── tasks.md
│   │   ├── design.md
│   │   └── specs/
│   └── archive/            # 已完成的变更提案归档
└── AGENTS.md               # OpenSpec 工作流说明
```

## 与 `docs/` 的边界

为避免重复与漂移，请明确分工：

- `docs/`：记录**当前已实现系统**的说明、导航、运维与开发参考
- `openspec/`：记录**规格、设计决策、变更提案与未来方向**

如果某个主题已经在代码和 `docs/` 中有实现事实，请不要在 `openspec/` 里复制实现细节；在 `openspec/` 中更适合记录“为什么要改、准备怎么改、约束是什么”。

## 工作规则

- **当前行为** → 先看 `specs/` 与当前代码
- **提议中的变更** → 在 `changes/<change-id>/` 下创建提案
- **已完成提案** → 归档到 `changes/archive/`
- **历史说明** → 优先归档，不要继续放在主导航层

## 如何检查当前状态

```bash
# 查看项目上下文
cat openspec/project.md

# 查看当前规格
ls openspec/specs/

# 查看待处理变更
ls openspec/changes/

# 查看某个规格
cat openspec/specs/<spec-name>/spec.md

# 查看某个变更提案
cat openspec/changes/<change-id>/proposal.md
```

## 备注

- 不要在这里硬编码“当前有哪些 proposal/spec”的静态列表；目录本身才是最不容易过期的入口。
- 如果旧文档仍引用 `PROJECT-CONTEXT.md`，这是预期行为；新文档请优先引用 `project.md`。
