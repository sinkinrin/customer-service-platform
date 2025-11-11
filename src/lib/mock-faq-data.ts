/**
 * Mock FAQ Data
 * 
 * Temporary mock data for FAQ/Knowledge Base until Zammad KB is configured
 */

export interface MockFAQCategory {
  id: number
  name: string
  description: string
  icon: string
  articleCount: number
}

export interface MockFAQArticle {
  id: number
  categoryId: number
  title: string
  content: string
  keywords: string[]
  views: number
  helpful: number
  notHelpful: number
  createdAt: string
  updatedAt: string
}

export const mockFAQCategories: MockFAQCategory[] = [
  {
    id: 1,
    name: '账户与登录',
    description: '账户注册、登录、密码重置等问题',
    icon: 'user',
    articleCount: 5,
  },
  {
    id: 2,
    name: '工单管理',
    description: '如何创建、查看和管理工单',
    icon: 'ticket',
    articleCount: 4,
  },
  {
    id: 3,
    name: '在线咨询',
    description: '使用在线咨询功能的指南',
    icon: 'message-circle',
    articleCount: 3,
  },
  {
    id: 4,
    name: '常见问题',
    description: '最常见的问题和解答',
    icon: 'help-circle',
    articleCount: 6,
  },
]

export const mockFAQArticles: MockFAQArticle[] = [
  // 账户与登录
  {
    id: 1,
    categoryId: 1,
    title: '如何注册新账户？',
    content: `
# 如何注册新账户

注册新账户非常简单，请按照以下步骤操作：

1. 点击登录页面的"注册"按钮
2. 填写您的邮箱地址
3. 设置一个安全的密码（至少8个字符，包含字母和数字）
4. 填写您的姓名和联系方式
5. 阅读并同意服务条款
6. 点击"注册"按钮

注册成功后，系统会发送一封验证邮件到您的邮箱，请点击邮件中的链接完成验证。

**注意事项：**
- 请使用真实的邮箱地址，以便接收重要通知
- 密码请妥善保管，不要与他人分享
- 如果没有收到验证邮件，请检查垃圾邮件文件夹
    `,
    keywords: ['注册', '账户', '新用户', '邮箱验证'],
    views: 1250,
    helpful: 98,
    notHelpful: 5,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-05T10:30:00Z',
  },
  {
    id: 2,
    categoryId: 1,
    title: '忘记密码怎么办？',
    content: `
# 忘记密码怎么办

如果您忘记了密码，可以通过以下步骤重置：

1. 在登录页面点击"忘记密码"链接
2. 输入您注册时使用的邮箱地址
3. 点击"发送重置链接"
4. 检查您的邮箱，点击重置密码的链接
5. 设置新密码并确认
6. 使用新密码登录

**安全提示：**
- 重置链接有效期为24小时
- 如果没有收到邮件，请检查垃圾邮件文件夹
- 建议使用强密码，包含大小写字母、数字和特殊字符
- 不要在多个网站使用相同的密码
    `,
    keywords: ['密码', '重置', '忘记密码', '找回密码'],
    views: 2100,
    helpful: 156,
    notHelpful: 8,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-04T14:20:00Z',
  },
  {
    id: 3,
    categoryId: 1,
    title: '如何修改个人信息？',
    content: `
# 如何修改个人信息

您可以随时更新您的个人信息：

1. 登录您的账户
2. 点击右上角的用户头像
3. 选择"设置"或"个人资料"
4. 在个人信息页面修改需要更新的内容
5. 点击"保存"按钮

**可修改的信息包括：**
- 姓名
- 联系电话
- 公司名称
- 地址信息
- 语言偏好
- 通知设置

**注意：**
- 邮箱地址修改后需要重新验证
- 某些信息可能需要管理员审核
    `,
    keywords: ['个人信息', '修改资料', '设置', '更新信息'],
    views: 850,
    helpful: 72,
    notHelpful: 3,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-06T09:15:00Z',
  },

  // 工单管理
  {
    id: 4,
    categoryId: 2,
    title: '如何创建工单？',
    content: `
# 如何创建工单

创建工单有多种方式：

## 方式一：通过在线咨询
1. 点击"在线咨询"
2. 描述您的问题
3. 系统会自动创建工单

## 方式二：直接提交工单
1. 进入"工单管理"页面
2. 点击"提交工单"按钮
3. 填写工单信息：
   - 标题（简要描述问题）
   - 详细描述
   - 优先级
   - 相关附件（如有）
4. 点击"提交"

**提示：**
- 请尽可能详细地描述问题
- 可以上传截图或相关文件
- 选择合适的优先级有助于更快处理
    `,
    keywords: ['创建工单', '提交工单', '新建工单', '工单'],
    views: 1800,
    helpful: 145,
    notHelpful: 12,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-05T16:45:00Z',
  },
  {
    id: 5,
    categoryId: 2,
    title: '如何查看工单状态？',
    content: `
# 如何查看工单状态

您可以随时查看工单的处理状态：

1. 登录您的账户
2. 进入"我的工单"页面
3. 查看工单列表，包含：
   - 工单编号
   - 标题
   - 当前状态
   - 优先级
   - 创建时间
   - 最后更新时间

## 工单状态说明

- **新建**：工单刚创建，等待分配
- **处理中**：客服正在处理
- **等待回复**：需要您提供更多信息
- **已解决**：问题已解决，等待确认
- **已关闭**：工单已完成

**提示：**
- 点击工单可查看详细信息和处理记录
- 您会收到工单状态变更的通知
    `,
    keywords: ['工单状态', '查看工单', '工单进度', '跟踪工单'],
    views: 1500,
    helpful: 120,
    notHelpful: 6,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-06T11:30:00Z',
  },

  // 在线咨询
  {
    id: 6,
    categoryId: 3,
    title: '如何使用在线咨询？',
    content: `
# 如何使用在线咨询

在线咨询功能让您可以实时与客服沟通：

1. 点击"在线咨询"菜单
2. 系统会自动创建或加入现有对话
3. 在输入框中输入您的问题
4. 点击发送或按Enter键
5. 等待客服回复

**功能特点：**
- 实时消息通知
- 支持发送文件和图片
- 对话历史记录
- 自动转为工单（如需要）

**注意事项：**
- 工作时间内响应更快
- 复杂问题建议创建工单
- 对话记录会保存在系统中
    `,
    keywords: ['在线咨询', '实时聊天', '客服', '即时通讯'],
    views: 2200,
    helpful: 180,
    notHelpful: 15,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-05T13:20:00Z',
  },

  // 常见问题
  {
    id: 7,
    categoryId: 4,
    title: '客服工作时间是什么时候？',
    content: `
# 客服工作时间

我们的客服团队工作时间如下：

## 在线客服
- **工作日**：9:00 - 18:00
- **周末**：10:00 - 17:00
- **节假日**：休息

## 工单处理
- 24小时接收工单
- 工作时间内优先处理
- 紧急工单会在非工作时间处理

## 响应时间
- **高优先级**：2小时内响应
- **中优先级**：4小时内响应
- **低优先级**：8小时内响应

**提示：**
- 非工作时间可以提交工单
- 紧急问题请标记为高优先级
    `,
    keywords: ['工作时间', '客服时间', '营业时间', '响应时间'],
    views: 3500,
    helpful: 280,
    notHelpful: 20,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-04T10:00:00Z',
  },
  {
    id: 8,
    categoryId: 4,
    title: '如何联系客服？',
    content: `
# 如何联系客服

我们提供多种联系方式：

## 1. 在线咨询（推荐）
- 最快的联系方式
- 实时沟通
- 工作时间内即时响应

## 2. 提交工单
- 适合复杂问题
- 可以上传附件
- 有完整的处理记录

## 3. 邮件
- support@example.com
- 24小时接收
- 工作时间内回复

## 4. 电话
- 400-xxx-xxxx
- 工作日 9:00-18:00

**建议：**
- 简单问题使用在线咨询
- 复杂问题提交工单
- 紧急问题电话联系
    `,
    keywords: ['联系客服', '客服电话', '客服邮箱', '联系方式'],
    views: 2800,
    helpful: 220,
    notHelpful: 18,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-05T15:30:00Z',
  },
]

/**
 * Search FAQ articles by query
 */
export function searchFAQArticles(query: string, limit: number = 10): MockFAQArticle[] {
  if (!query) {
    return mockFAQArticles.slice(0, limit)
  }

  const lowerQuery = query.toLowerCase()
  const results = mockFAQArticles.filter((article) => {
    return (
      article.title.toLowerCase().includes(lowerQuery) ||
      article.content.toLowerCase().includes(lowerQuery) ||
      article.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
    )
  })

  return results.slice(0, limit)
}

/**
 * Get FAQ article by ID
 */
export function getFAQArticleById(id: number): MockFAQArticle | undefined {
  return mockFAQArticles.find((article) => article.id === id)
}

/**
 * Get FAQ articles by category ID
 */
export function getFAQArticlesByCategory(categoryId: number): MockFAQArticle[] {
  return mockFAQArticles.filter((article) => article.categoryId === categoryId)
}

/**
 * Get FAQ category by ID
 */
export function getFAQCategoryById(id: number): MockFAQCategory | undefined {
  return mockFAQCategories.find((category) => category.id === id)
}

