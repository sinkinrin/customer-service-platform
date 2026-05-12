# 变更：AI 对话历史与缓存

## 原因
当前 AI 对话入口会先查询旧 active 会话，再决定复用或新建；用户反馈首轮进入超过 10 秒。旧逻辑声称会关闭旧会话，但实际链路存在未关闭旧会话的 bug，导致历史会话状态不可靠。

## 变更内容
- 修复创建新 AI 对话时旧 active 会话必须被关闭的行为。
- AI 对话入口默认创建新会话，不再为了首屏进入预加载旧会话。
- 增加历史对话入口，旧会话列表按需加载。
- 对历史会话列表与历史消息增加客户端缓存，优先显示缓存，再刷新服务端数据。
- 打开旧会话时才加载该会话消息，避免影响新对话首屏。
- 明确认证用户、会话归属、并发创建与缓存隔离规则。
- 明确历史 UI 状态、分页、缓存容量、缓存过期和首屏性能约束。

## 影响
- 受影响的规格：`ai-conversation-history`
- 受影响的代码：
  - `src/app/customer/conversations/page.tsx`
  - `src/app/customer/conversations/[id]/page.tsx`
  - `src/components/conversation/conversation-header.tsx`
  - `src/lib/hooks/use-conversation.ts`
  - `src/lib/stores/conversation-store.ts`
  - `src/lib/ai-conversation-service.ts`
  - `src/app/api/conversations/route.ts`
  - `src/app/api/conversations/[id]/messages/route.ts`
  - 相关测试
