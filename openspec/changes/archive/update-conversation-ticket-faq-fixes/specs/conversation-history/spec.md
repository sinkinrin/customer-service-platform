## ADDED Requirements
### Requirement: AI 会话历史顺序一致
系统 SHALL 在展示与传递 AI 会话历史时保持时间顺序一致，避免用户视角与客服上下文不一致。

#### Scenario: 重新进入 AI 会话
- **WHEN** 客户重新打开处于 AI 模式的会话
- **THEN** 系统 SHALL 以时间升序渲染历史消息并包含先前的 AI 回复

#### Scenario: 转人工携带完整历史
- **WHEN** 客户将 AI 会话转人工
- **THEN** 系统 SHALL 按时间顺序将 AI 历史传递给人工通道，且不会出现顺序颠倒或遗漏
