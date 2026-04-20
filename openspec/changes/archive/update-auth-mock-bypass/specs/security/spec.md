# 认证安全要求（归档摘要）

## 状态
已归档，保留最小摘要。

## 为什么保留
这项归档涉及 mock auth / session 边界，是仍然具有长期参考价值的安全要求。

## 核心原则
- 受保护 API 必须建立在服务端已验证 session 之上
- 被篡改的认证 cookie 不得被接受
- 高权限 API 必须做服务端角色校验
- mock / fallback 认证路径不能越权成为生产认证模型

## 当前应参考
- `src/auth.ts`
- `middleware.ts`
- `src/lib/utils/auth.ts`
- 当前安全审计与代码实现

这份归档只保留安全边界原则，不再作为详细实施文档。
