/**
 * Mock FAQ Data for Database Seeding
 *
 * Minimal dataset for initializing the FAQ database
 */

export interface MockFAQCategory {
  id: number
  name: string
  description: string
  icon: string
}

export interface MockFAQArticle {
  id: number
  categoryId: number
  title: string
  content: string
  keywords: string[]
  views: number
}

export const mockFAQCategories: MockFAQCategory[] = [
  {
    id: 1,
    name: '账号与登录',
    description: '账号注册、登录问题和密码找回',
    icon: 'user',
  },
  {
    id: 2,
    name: '产品功能',
    description: '产品使用方法和功能介绍',
    icon: 'box',
  },
  {
    id: 3,
    name: '订单与支付',
    description: '订单查询、支付问题和退款',
    icon: 'shopping-cart',
  },
  {
    id: 4,
    name: '技术支持',
    description: '技术问题和故障排除',
    icon: 'wrench',
  },
]

export const mockFAQArticles: MockFAQArticle[] = [
  {
    id: 1,
    categoryId: 1,
    title: '如何注册账号？',
    content: '您可以通过以下步骤注册账号：\n1. 点击页面右上角的"注册"按钮\n2. 填写您的邮箱地址和密码\n3. 点击确认邮件中的链接激活账号',
    keywords: ['注册', '账号', '邮箱'],
    views: 150,
  },
  {
    id: 2,
    categoryId: 1,
    title: '忘记密码怎么办？',
    content: '如果您忘记了密码，请按以下步骤重置：\n1. 点击登录页面的"忘记密码"\n2. 输入您注册时使用的邮箱\n3. 查收邮件并点击重置链接\n4. 设置新密码',
    keywords: ['密码', '重置', '找回'],
    views: 200,
  },
  {
    id: 3,
    categoryId: 2,
    title: '如何使用产品主要功能？',
    content: '产品的主要功能包括：\n- 数据管理：支持导入导出多种格式\n- 报表分析：自动生成可视化报表\n- 团队协作：支持多人同时编辑',
    keywords: ['功能', '使用', '教程'],
    views: 300,
  },
  {
    id: 4,
    categoryId: 3,
    title: '如何查询订单状态？',
    content: '您可以通过以下方式查询订单：\n1. 登录后进入"我的订单"页面\n2. 使用订单号搜索\n3. 查看订单详情和物流信息',
    keywords: ['订单', '查询', '状态'],
    views: 180,
  },
  {
    id: 5,
    categoryId: 4,
    title: '遇到技术问题如何解决？',
    content: '如果您遇到技术问题，请尝试：\n1. 刷新页面或清除浏览器缓存\n2. 检查网络连接\n3. 尝试使用其他浏览器\n4. 如问题持续，请联系技术支持',
    keywords: ['技术', '问题', '故障'],
    views: 120,
  },
]
