# Fix authentication bypass on protected APIs

## 原因
- 客户端可写的 `auth-session` JSON cookie 被当作真实身份使用，缺少签名、HttpOnly 与服务端校验，角色可被伪造。
- 中间件放行全部请求，`requireAuth` 仅读取 cookie，不做有效期或来源验证。

## 影响范围
- Zammad 工单 API：`/api/tickets`、`/api/tickets/[id]` 使用全局管理员 Token，可被伪造 admin/staff 滥用。
- FAQ 后台 API：`/api/admin/faq/*` 依赖可伪造的角色，支持未授权增删改。
- 会话 API：`/api/conversations*` 允许伪造 staff/admin 读取或写入所有会话与消息。

## 影响
- 影响的规格：新增 `security` 规范。
- 影响的代码：`src/lib/utils/auth.ts`，`src/lib/utils/cookies.ts`，`src/middleware.ts`，`src/app/api/tickets/**/*`，`src/app/api/admin/faq/**/*`，`src/app/api/conversations/**/*`。
