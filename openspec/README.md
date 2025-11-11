# OpenSpec 文档

此目录包含客户服务平台的 OpenSpec 规范和变更提案。

## 概述

OpenSpec 用于以结构化的方式定义和管理系统需求和变更。它有助于确保所有利益相关者都清楚地了解正在构建什么以及为什么构建。

## 目录结构

```
openspec/
├── project.md              # 项目约定和上下文
├── specs/                  # 当前系统规范
│   └── [功能]/             # 单个功能规范
│       ├── spec.md         # 需求和场景
│       └── design.md       # 技术设计决策
├── changes/                # 提议的变更
│   ├── [变更名称]/         # 单个变更提案
│   │   ├── proposal.md     # 原因、内容和影响
│   │   ├── tasks.md        # 实施清单
│   │   ├── design.md       # 技术决策（可选）
│   │   └── specs/          # 对现有规范的增量变更
│   └── archive/            # 已完成的变更
└── AGENTS.md               # AI 代理的说明
```

## 当前规范

- `faq-system` - 自建 FAQ 知识库系统

## 当前变更提案

- `add-self-hosted-faq-kb` - 添加自建 FAQ 知识库系统
- `optimize-loading-speed` - 优化FAQ系统加载速度
- `optimize-platform-performance` - 优化客户服务平台整体性能

## 使用方法

1. **查看现有规范**：查看 `specs/` 目录
2. **提议变更**：在 `changes/` 中创建新目录和提案
3. **跟踪进度**：在 `tasks.md` 中更新实施清单
4. **归档已完成的变更**：将已完成的变更移动到 `changes/archive/`

## 命令

```bash
# 列出所有规范
ls openspec/specs/

# 列出所有变更提案
ls openspec/changes/

# 查看特定规范
cat openspec/specs/[功能]/spec.md

# 查看变更提案
cat openspec/changes/[变更名称]/proposal.md
```