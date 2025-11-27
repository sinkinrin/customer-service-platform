## 1. FAQ 渲染安全
- [x] 1.1 选型/引入 DOMPurify 或等效方案，并在 `customer/faq/[id]/page.tsx` 渲染前做 HTML 清洗（保留基本格式）。
- [ ] 1.2 为 FAQ 详情页添加单元/端到端用例，验证恶意脚本不会执行且普通 Markdown 仍能展示。

## 2. 对话消息分页
- [x] 2.1 调整 `GET /api/conversations/[id]/messages`：默认按照 `created_at` 倒序，支持 `before`/`after` 或 page cursor，保证能取到最新消息。
- [x] 2.2 更新 `useConversation.fetchMessages` 及相关组件，默认显示最新消息并暴露"加载更多"逻辑；补充 store 去重。
- [ ] 2.3 针对长对话补充回归测试，覆盖客服/客户视角。

## 3. 工单客户信息
- [x] 3.1 扩展 `/api/tickets`（以及 `/api/tickets/[id]` 如有需要）调用 Zammad 用户资料，返回 `customer_name/email` 字段，注意缓存与错误处理。
- [x] 3.2 更新 `TicketList`、`TicketDetail` 等组件以显示新字段，并在缺失时做降级（例如展示 ticket.number）。
- [ ] 3.3 编写接口测试或模拟，确保匿名字段不会再出现 `undefined`。
