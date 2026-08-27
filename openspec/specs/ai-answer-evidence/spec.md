# ai-answer-evidence Specification

## Purpose

定义员工 AI 对话中回答证据的可见性、持久化和流式边界，使员工能够核查 FastGPT 检索词、引用文档和命中内容，同时不向客户暴露内部知识库明细。

## Requirements

### Requirement: 员工按消息查看 AI 回答证据

系统 SHALL 在员工 AI 对话页面为已捕获证据的 AI 消息提供默认折叠的引用入口，并将证据与具体回答绑定。

#### Scenario: 员工查看引用内容

- **GIVEN** AI 消息包含 FastGPT 回答证据
- **WHEN** 员工打开 `/staff/conversations/{id}`
- **THEN** 消息操作区 SHALL 在右侧显示小型引用按钮
- **AND** 引用内容 SHALL 默认保持折叠
- **WHEN** 员工点击引用按钮
- **THEN** 系统 SHALL 展示检索词、引用文档、来源 ID 和命中内容

#### Scenario: 员工复制证据用于反馈

- **GIVEN** 员工已展开某条 AI 消息的引用内容
- **WHEN** 员工选择复制证据
- **THEN** 系统 SHALL 复制该消息的检索词和引用内容
- **AND** 页面 SHALL 提示员工可结合点踩反馈说明引用不相关、过期或使用错误

### Requirement: 回答证据仅向员工角色返回

系统 SHALL NOT 将 FastGPT 工具参数、工具结果、工作流明细或规范化证据事件发送给客户浏览器。

#### Scenario: 员工发起流式 AI 对话

- **WHEN** staff 或 admin 通过 `/api/ai/chat` 发起 FastGPT 流式请求
- **THEN** 服务端 SHALL 返回规范化且有界的 `evidence` SSE 事件
- **AND** 原始 `toolCall`、`toolParams`、`toolResponse` 和 `flowResponses` SHALL NOT 直接透传到浏览器

#### Scenario: 客户发起流式 AI 对话

- **WHEN** customer 通过 `/api/ai/chat` 发起 FastGPT 流式请求
- **THEN** 服务端 SHALL 返回回答文本和允许的节点状态
- **AND** 服务端 SHALL NOT 返回 `evidence` 事件
- **AND** 服务端 SHALL NOT 透传 FastGPT 原始工具或知识库明细事件

### Requirement: 证据随 AI 消息持久化

系统 SHALL 将经过长度限制和去重处理的检索词与引用内容保存到对应 AI 消息 metadata，使员工重新打开历史对话后仍可查看。

#### Scenario: 流式回答完成并成功持久化

- **WHEN** FastGPT 流式回答结束且服务端保存 AI 消息
- **THEN** 消息 metadata SHALL 包含版本化的 `aiEvidence`
- **AND** `aiEvidence` SHALL 包含 provider、检索记录和引用记录
- **AND** 单条引用内容及引用总数 SHALL 受到服务端上限约束

#### Scenario: 员工重新打开历史对话

- **GIVEN** 历史 AI 消息已保存 `aiEvidence`
- **WHEN** 员工重新打开该对话
- **THEN** 页面 SHALL 从消息 metadata 恢复引用按钮和引用内容

### Requirement: 服务端完成事件控制

系统 SHALL 在有界等待窗口内消费 FastGPT 上游完成标记后的剩余事件，并由本系统在证据提取和消息持久化完成后发送最终完成事件。

#### Scenario: FastGPT 在回答完成标记后返回流程明细

- **WHEN** 上游先发送回答 `[DONE]`，随后发送 `flowResponses` 或其他证据事件
- **THEN** 服务端 SHALL 继续读取上游流直至关闭、错误或完成标记后的证据等待窗口结束
- **AND** 等待窗口结束后服务端 SHALL 取消仍未关闭的上游连接，避免完整回答被误判为超时错误
- **AND** 服务端 SHALL 在发送本地最终 `done` 前完成证据提取和消息持久化
