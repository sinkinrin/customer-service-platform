# Fix FAQ Rendering, Conversation Pagination, and Ticket Listing Issues

## 背景
管理员、客服和终端客户已经可以在 FAQ、对话以及工单界面协同工作，但最新回归测试暴露出三个影响体验和安全的缺陷：
1. FAQ 文章详情页直接用 `dangerouslySetInnerHTML` 渲染数据库内容（`src/app/customer/faq/[id]/page.tsx:167`），任何被侵入的资料库或恶意翻译都可以注入脚本，前台没有做任何 HTML 清洗。
2. 对话消息 API（`src/app/api/conversations/[id]/messages/route.ts:59-65`）先按时间升序排序再 `slice(offset, offset + limit)`，`useConversation.fetchMessages` 也写死 `limit=50` 且永远使用 `offset=0`（`src/lib/hooks/use-conversation.ts:163-178`）。结果是对话一旦超过 50 条，页面只会展示最老的 50 条，最新消息被完全截断，客服和客户都会看到过期上下文。
3. 工单列表组件（`src/components/ticket/ticket-list.tsx:134-146`）显示 `Customer: {ticket.customer}`，但 `GET /api/tickets` 的 `transformTicket` 仅返回 `state/priority` 文本（`src/app/api/tickets/route.ts:77-107`），没有任何客户姓名/邮箱映射，因此界面永远显示 “Customer: undefined”。

## 目标
- 为 FAQ 详情页加上可信的内容清洗或安全渲染路径，防止 XSS。
- 让对话 API 与 hook 能稳定获取最新消息，并且提供分页/“加载更多” 能力而不是截断。
- 让工单列表展示真实的客户标识（至少 email/名称），必要时扩展 API 以拉取对应用户资料。

## 影响范围
- FAQ 前端渲染层，需要引入 Markdown/HTML parser 或 DOMPurify 之类工具，确保多语言内容显示安全。
- 对话 API + `useConversation` hook + `MessageList` 相关 UI，需要调整排序方式（按最新倒序）并暴露加载更多控制，避免 breaking change。
- 工单 API 层需要附带客户信息（通过 Zammad user 查询或缓存），前端列表与详情也要读取新字段。

## 价值 & 风险
- 修复后可以阻止高危脚本注入，保障客服门户安全。
- 对话修复能避免“只看到老消息”的严重体验问题，减少重复转人工。
- 工单列表能够一眼识别客户身份，方便管理员过滤。
- 需要注意 FAQ 清洗引入的 bundle 体积、对话分页改动对现有状态管理的影响，以及调用 Zammad user API 可能增加延迟，需要做好缓存或并发控制。
