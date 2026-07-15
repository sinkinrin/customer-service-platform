# staff-ai-assistant Specification

## Purpose

定义 staff AI 助手当前行为边界：该面板与客户 AI 会话隔离，保留自己的上游上下文，并可选接收工单上下文增强回答。

## Requirements

### Requirement: staff AI 会话上游隔离
系统 SHALL 为 staff AI 助手的上游对话上下文提供按用户与面板会话隔离的标识 `staff-{userId}-{sessionId}`，确保不同 staff 用户或不同面板会话之间不共享上游对话上下文。工单信息仅作为消息上下文前缀注入，不参与会话标识。

#### Scenario: 不同 staff 互不串扰
- **GIVEN** staff A 与 staff B 分别打开 AI 助手面板
- **WHEN** 两人分别发起提问
- **THEN** 系统 SHALL 为两人生成不同的上游会话标识
- **AND** 任一方的提问 SHALL NOT 出现在另一方的上游对话上下文中

#### Scenario: 同一面板会话上下文连续
- **GIVEN** staff 在同一次面板会话中连续发起多轮提问
- **WHEN** 每轮请求携带相同的 `sessionId`
- **THEN** 系统 SHALL 复用同一上游会话标识 `staff-{userId}-{sessionId}`
- **AND** 上游 SHALL 能基于该标识维持多轮上下文

#### Scenario: 缺省参数回退
- **WHEN** 请求未携带 `sessionId`
- **THEN** 系统 SHALL 回退为一次性会话标识
- **AND** 请求 SHALL 正常处理

### Requirement: staff AI 可选接收工单上下文
系统 SHALL 允许 staff AI 请求附带工单标题、客户名和文章摘要等上下文，以便产生更贴近当前工单的回答。

#### Scenario: 携带工单上下文发问
- **WHEN** staff AI 请求携带 `ticketContext`
- **THEN** 系统 SHALL 将工单标题和可选文章内容作为上下文前缀传给上游 provider
- **AND** 不同工单上下文 SHALL NOT 改变会话隔离主键规则

### Requirement: staff AI 不写入客户 AI 会话表
系统 SHALL 将 staff AI 助手与客户 AI 会话持久化边界分开处理。

#### Scenario: staff AI 请求成功返回
- **WHEN** staff 通过 `/api/staff/ai/chat` 发起请求并成功获得回答
- **THEN** 系统 SHALL 返回回答内容或流式响应
- **AND** 系统 SHALL NOT 把该回答写入客户 `AiConversation` / `AiMessage` 历史表作为客户聊天记录