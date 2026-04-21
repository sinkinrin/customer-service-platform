# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: older changelog content in this repository had encoding corruption. This file has been normalized into a readable summary entrypoint. Historical 2025 releases remain archived under `changelogs/`.

## [0.3.0] - 2026-04-21

### ✨ 新增

#### Service Group 驱动的客户归属与后台管理
- **提交**: `084c224`, `998f0e8`, `cf9fc1b`, `04b343c`, `b009bf1`, `5b3fef2`, `50bf116`, `b5d662e`, `f992d87`
- **变更**:
  - 新增 `ServiceGroup` / `CustomerGroupAssignment` 模型与相关数据服务
  - 将客户归属、工单创建、邮件路由、会话地区推导切换到 assignment-first 语义
  - 新增管理端 Service Group 页面、客户服务分组编辑入口与新建客户表单支持
  - 新建与导入 customer 统一改为显式选择 `service group`，`region` 改为派生展示值
  - 为 customer 创建补上 assignment 失败时的 Zammad 用户回滚，减少半成功状态
- **影响**: 客户归属、地区派生、工单路由和后台操作入口的语义统一，分区管理能力正式落地

### 🔧 重构

#### 移除旧的 customer region 主控路径
- **提交**: `94a1021`, `8c87f19`
- **变更**:
  - 移除 binding-first 运行时分配路径
  - 将 customer `region` 从后台主控字段收敛为由 service group 派生
- **影响**: 旧的 `note.Region` / binding 双轨语义被进一步清理，后续维护成本下降

### 🐛 修复

#### 修复工单流程与相关前端状态问题
- **提交**: `a93a536`, `08d46e0`, `0f4a62a`
- **变更**:
  - 修复 ticket workflow 与前端状态处理中的回归问题
  - 将 welcome 流程从 `Region` note 标记中解耦
  - 修正若干 assignment-first 路径下的行为细节
- **影响**: 工单流转更稳定，service-group cutover 后的前后端行为更一致

### 🧪 测试

#### 增加 service-group cutover 与后台回归测试
- **提交**: `84adb3e`, `f992d87`
- **变更**:
  - 增加 service-group cutover smoke test
  - 补充后台 service group 管理、新建 customer、customer 编辑与导入链路测试
- **影响**: 本次归属模型切换有了更完整的回归保护

### 📝 文档

#### 补充部署 runbook 与文档整理
- **提交**: `0ca2e9e`, `a1d0339`
- **变更**:
  - 新增 service group 部署 runbook
  - 清理旧文档并整理 OpenSpec / 历史归档
- **影响**: 部署与后续维护的文档入口更清晰

## [0.2.2] - 2026-04-16

### 📝 文档

#### 文档归档与索引刷新
- **提交**: `9744bd0`
- **变更**:
  - 归档已完成的实现计划与历史设计说明
  - 刷新 `docs/` 导航索引，区分当前文档与历史资料
- **影响**: 文档入口更清晰，后续文档整理有了更稳定的基线

## [0.2.1] - 2026-04-14

### ✨ 新增

#### 视觉界面升级
- **提交**: `9ee3119`
- **变更**:
  - 优化深色模式显示效果
  - 提升活动区域与图表展示质感
  - 统一部分 UI 视觉风格
- **影响**: 管理端和工单相关界面的视觉一致性与可读性提升

### 🐛 修复

#### 修复语义化设计令牌与状态样式问题
- **提交**: `79fa1bf`, `b763f85`
- **问题**:
  - 部分界面仍使用硬编码颜色或内联样式
  - Staff 工单列表的 merged 状态徽标样式缺失
- **修复**:
  - 用语义化设计令牌替换硬编码颜色和内联样式
  - 补齐 merged 状态的徽标样式
- **影响**: 界面主题一致性更好，状态显示更准确

#### 修复内联附件预览的并发与路径重写问题
- **提交**: `e9c2191`
- **问题**:
  - 多张图片同时内联渲染时可能因附件缓存竞争而失败
  - Zammad API 附件路径在部分场景下重写不安全
- **修复**:
  - 处理并发缓存缺失场景
  - 更安全地重写 Zammad API 路径
- **影响**: 多附件消息和工单回复的内联预览稳定性提升

## [0.2.0] - 2026-04-10

### ✨ 新增

#### Customer-Staff Binding 与绑定优先分配
- **提交**: `ad64c39`, `b2193cc`, `b8e088b`, `94bb379`, `c78d872`, `8e14528`
- **变更**:
  - 新增 customer-staff binding 的 CRUD 服务与管理 API
  - 工单创建、邮件路由、批量分配接入 `customerId`
  - 自动分配逻辑升级为“绑定优先 → 假期替补 → 负载均衡”
  - 新增删除绑定、批量转移等管理能力
- **影响**: 客户与固定负责人之间的关联更加稳定，工单分配更符合业务预期

#### 附件拖拽上传与内联预览能力
- **提交**: `19ff778`, `0f32091`, `99a6ade`, `4592ae9`, `42c53b8`, `95f03e1`, `2c9a638`, `9c27d83`, `840acdc`, `17f1e8a`, `f3107c1`
- **变更**:
  - 新增 MIME 辅助能力和 `?inline=true` 预览支持
  - 引入 `use-drag-drop`、lightbox、media renderer 等组件
  - 对 conversation、customer ticket reply、staff ticket reply 补齐拖拽上传
  - 增加图片/视频/文件的内联显示与缩略图体验
- **影响**: 客户和坐席在对话与工单中的附件处理体验显著提升

#### AI 对话与质检能力增强
- **提交**: `fb2091f`, `683cad0`
- **变更**:
  - 新增 AI Q&A review 工具供坐席复核 AI 回复质量
  - 优化返回会话时自动创建新对话的体验，减少页面切换割裂感
- **影响**: AI 对话运营和人工复核流程更完整

### 🔒 安全

#### 修复安全审计中的高危与中危问题
- **提交**: `37c5185`
- **变更**:
  - 修复安全审计中识别出的 HIGH / MEDIUM 问题
- **影响**: 系统整体安全基线提升

### 🐛 修复

#### 修复附件路由与相关回归问题
- **提交**: `15ee334`, `d7681a3`
- **问题**:
  - 测试环境下附件路由在缺失 request URL 时兼容性不足
  - `autoAssignSingleTicket` 新签名引入后，现有测试未同步
- **修复**:
  - 兼容缺失 request URL 的测试场景
  - 更新现有测试以适配新的 `customerId` 参数
- **影响**: 附件相关测试与分配流程测试恢复稳定

#### 修复门户与知识库占位问题
- **提交**: `4682739`, `e95d01c`
- **问题**:
  - 缺少 portal 根页面与 staff knowledge base 占位路径
  - 知识库占位文案引入了无效 i18n key 风险
- **修复**:
  - 补齐缺失的入口页和占位实现
  - 简化知识库占位内容以避免错误翻译键
- **影响**: 页面入口更完整，前端回归风险更低

### 🔧 重构

#### 提取共享坐席辅助逻辑
- **提交**: `e2e430a`
- **变更**:
  - 提取 `checkIsOnVacation`、`getAgentDisplayName`、`isAgentEligible` 等共享 helper
- **影响**: 分配相关逻辑更集中，后续维护成本更低

### 🧪 测试

#### 补充 binding 管理测试
- **提交**: `d3f5451`
- **变更**:
  - 新增 admin customer-bindings API 测试
- **影响**: 绑定管理相关 API 的回归保护增强

### 📝 文档

#### 补充附件预览相关设计与实现计划
- **提交**: `b3c127d`, `88c482a`, `3c27463`
- **变更**:
  - 增加 attachment inline preview / drag-drop 的设计说明与实现计划
- **影响**: 对附件能力的设计背景与实现过程有更清晰的文档留痕

### 📦 杂务

#### 补充迁移与配套清理
- **提交**: `1487b33`
- **变更**:
  - 补充缺失 migration
  - 引入 DragOverlay 组件与若干文档/清理项
- **影响**: 为 0.2.0 版本落地提供收尾支持

---

## 📚 历史版本

更早的 2025 年版本记录已归档：

| 范围 | 文件 |
|------|------|
| v0.1.0 - v0.1.9 | [changelogs/CHANGELOG-2025-early.md](changelogs/CHANGELOG-2025-early.md) |
| v0.2.0 - v0.2.1（旧归档快照） | [changelogs/CHANGELOG-2025-mid.md](changelogs/CHANGELOG-2025-mid.md) |
