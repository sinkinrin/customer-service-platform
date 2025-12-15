3.2 ⚠️ 关键问题与风险
问题 1：API 路由测试严重不足
现状：

40+ API 端点，仅有 1 个 API 测试文件 (conversations-real.test.ts)
其他关键 API 完全没有测试：
/api/tickets/* - 工单 CRUD（Zammad 集成）
/api/admin/* - 管理员操作
/api/auth/* - NextAuth 认证流程
/api/faq/* - FAQ 知识库
风险等级：🔴 高风险

实际影响：

Zammad 集成的 API 可能在 Zammad 更新后出现兼容性问题
权限检查逻辑可能被绕过
错误处理路径未经验证
问题 2：组件测试缺失
现状：

30+ 业务组件 零组件测试
没有使用 @testing-library/react 测试组件（虽然已安装）
关键未测试组件：

conversation/message-list.tsx - 消息渲染
conversation/message-input.tsx - 消息发送
ticket/ticket-detail.tsx - 工单详情
auth/protected-route.tsx - 路由保护
风险等级：🟡 中等风险

实际影响：

UI 回归问题难以发现
复杂交互逻辑（如消息发送、表单验证）可能有隐藏 bug
问题 3：场景测试部分是"伪测试"

ticket-lifecycle.test.ts
__tests__/scenarios
问题：很多场景测试实际上是在测试自己定义的静态数据，而不是测试真实的业务逻辑代码。这类测试：

不会发现任何真实 bug
给人虚假的安全感
增加维护负担
风险等级：🟡 中等（浪费资源，但不会直接导致问题）

问题 4：Zammad 集成测试缺失
现状：
ZammadClient 有 600+ 行代码，包含：

票务 CRUD
用户管理
知识库 API
重试机制
错误处理
但没有任何单元测试！

风险等级：🔴 高风险

实际影响：

Zammad API 变更后可能导致生产故障
超时、重试、错误处理逻辑未验证
X-On-Behalf-Of 头部处理可能有问题
问题 5：E2E 测试脆弱性
问题：

选择器依赖于 UI 文本，国际化切换后可能失败
没有 data-testid 属性
超时设置过长（15秒），可能掩盖性能问题
3.3 ❌ 缺失的关键测试类型
测试类型	状态	优先级	原因
Zammad Client 单元测试	❌ 无	P0	外部集成是最易出错的地方
API 路由集成测试	❌ 几乎无	P0	API 是前后端契约
Zustand Store 行为测试	部分	P1	状态管理是 UI 逻辑核心
组件渲染测试	❌ 无	P1	防止 UI 回归
Error Boundary 测试	❌ 无	P2	错误恢复是用户体验关键
WebSocket/SSE 测试	❌ 无	P2	实时通信可靠性
四、实用改进建议（按优先级排序）
🔴 P0：高影响、高风险
1. 添加 Zammad Client Mock 测试
ROI：🔥 极高 - 外部集成是最容易出错的地方

2. 为核心 API 路由添加集成测试
优先覆盖：

POST /api/tickets - 工单创建（涉及 Zammad）
PUT /api/tickets/[id] - 工单更新（权限检查）
POST /api/auth/signin - 登录流程
🟡 P1：中等优先级
3. 删除或重写"伪测试"
当前 ticket-lifecycle.test.ts 等文件有大量无效测试。建议：

删除：测试静态数据结构的用例
保留：测试 filterTicketsByRegion、validateTicketAccess 等真实函数的用例
重写：将业务场景测试改为调用真实 API 或真实业务函数
4. 添加关键组件的基础渲染测试
🟢 P2：低优先级（暂时不需要）
5. 以下测试 暂时不建议投入：
不建议测试的内容	原因
shadcn/ui 组件	这些是第三方组件，已经过充分测试
next-intl 翻译渲染	已有 i18n-completeness 测试检测缺失 key
Prisma 模型	当前使用 SQLite，未来可能迁移，测试 ROI 低
CSS/样式测试	Tailwind 工具类无需测试
静态页面快照测试	维护成本高，收益低
五、覆盖率目标建议
当前 vitest.config.ts 设定的阈值：

建议调整：

模块	建议覆盖率	原因
src/lib/utils/	90%+	工具函数是最容易测试的
src/lib/zammad/	80%+	外部集成需要高覆盖
src/app/api/	70%+	API 路由需要基础覆盖
src/components/	50-60%	组件测试 ROI 较低
src/app/(customer|staff|admin)/	跳过	页面组件由 E2E 覆盖
六、总结
✅ 现状积极面
测试基础设施完整（Vitest + Playwright + MSW）
输入验证测试质量较好
权限边界测试有价值
测试全部通过（685/685）
⚠️ 需要改进的关键点
Zammad 集成零测试 → 最大风险点
API 路由测试严重不足 → 40+ 端点仅 1 个测试文件
存在大量"伪测试" → 浪费资源且给假安全感
组件测试缺失 → @testing-library/react 已装但未用
📋 下一步行动建议
为 ZammadClient 添加单元测试（Mock fetch）
为 /api/tickets/* 添加集成测试
清理 scenarios/ 目录中的无效测试
为 MessageInput、ProtectedRoute 添加组件测试
在 E2E 测试中添加 data-testid 属性以提高稳定性