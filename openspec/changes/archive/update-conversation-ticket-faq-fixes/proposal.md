# FAQ detail, ticket access control, and AI conversation history fixes

## 原因
- FAQ 详情接口在 `findUnique` 中加入非唯一条件直接报错，客户无法查看文章内容。
- 工单详情与文章接口缺少区域/归属校验，staff 只要知道工单 ID 就能跨区域读取或写入。
- AI 会话重进时历史按时间倒序，界面展示和转人工上下文顺序颠倒。

## 变更范围
- FAQ 详情 API 的查询与返回校验。
- 工单详情/回复 API 的区域与用户归属校验。
- 客户端 AI 会话历史的排序与转人工携带逻辑。

## 影响
- 覆盖 FAQ 浏览、工单读取/更新、会话转人工的关键路径。
- 需要补充区域授权与历史顺序的校验测试。
