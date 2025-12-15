/**
 * 测试 FAQ 数据 Fixtures
 */

export const testFaqCategories = {
  general: {
    id: 'cat_1',
    name: 'General',
    name_zh: '常见问题',
    slug: 'general',
    description: 'General frequently asked questions',
    order: 1,
  },
  
  account: {
    id: 'cat_2',
    name: 'Account & Login',
    name_zh: '账户与登录',
    slug: 'account-login',
    description: 'Account and login related questions',
    order: 2,
  },
  
  tickets: {
    id: 'cat_3',
    name: 'Ticket Management',
    name_zh: '工单管理',
    slug: 'ticket-management',
    description: 'Questions about ticket management',
    order: 3,
  },
}

export const testFaqArticles = {
  contactSupport: {
    id: 1,
    title: 'How to contact support?',
    title_zh: '如何联系客服？',
    content: '# How to contact support\n\nYou can contact us via:\n1. Live chat\n2. Submit a ticket\n3. Email',
    content_zh: '# 如何联系客服\n\n您可以通过以下方式联系我们：\n1. 在线聊天\n2. 提交工单\n3. 邮件',
    category_id: testFaqCategories.general.id,
    category: testFaqCategories.general.name,
    state: 'published' as const,
    views: 2800,
    likes: 45,
    dislikes: 2,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-15T00:00:00.000Z',
  },
  
  resetPassword: {
    id: 2,
    title: 'How to reset password?',
    title_zh: '忘记密码怎么办？',
    content: '# How to reset password\n\n1. Click "Forgot password" on login page\n2. Enter your email\n3. Check your inbox',
    content_zh: '# 忘记密码怎么办\n\n1. 在登录页面点击"忘记密码"\n2. 输入您的邮箱\n3. 检查收件箱',
    category_id: testFaqCategories.account.id,
    category: testFaqCategories.account.name,
    state: 'published' as const,
    views: 2100,
    likes: 30,
    dislikes: 1,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-10T00:00:00.000Z',
  },
  
  createTicket: {
    id: 3,
    title: 'How to create a ticket?',
    title_zh: '如何创建工单？',
    content: '# How to create a ticket\n\n1. Go to "My Tickets"\n2. Click "Create Ticket"\n3. Fill in the form',
    content_zh: '# 如何创建工单\n\n1. 进入"我的工单"\n2. 点击"创建工单"\n3. 填写表单',
    category_id: testFaqCategories.tickets.id,
    category: testFaqCategories.tickets.name,
    state: 'published' as const,
    views: 1800,
    likes: 25,
    dislikes: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-05T00:00:00.000Z',
  },
  
  draftArticle: {
    id: 4,
    title: 'Draft Article',
    title_zh: '草稿文章',
    content: '# Draft\n\nThis is a draft article.',
    content_zh: '# 草稿\n\n这是一篇草稿文章。',
    category_id: testFaqCategories.general.id,
    category: testFaqCategories.general.name,
    state: 'draft' as const,
    views: 0,
    likes: 0,
    dislikes: 0,
    created_at: '2025-01-20T00:00:00.000Z',
    updated_at: '2025-01-20T00:00:00.000Z',
  },
}

export type TestFaqCategory = typeof testFaqCategories.general
export type TestFaqArticle = typeof testFaqArticles.contactSupport
