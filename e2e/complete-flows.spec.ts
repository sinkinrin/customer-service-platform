/**
 * 完整业务流程 E2E 测试
 * 
 * 测试跨页面的端到端用户旅程
 * 注意：基础页面测试在各自的 portal spec 文件中
 */

import { test, expect } from '@playwright/test'

// 登录辅助函数
async function loginAs(
  page: import('@playwright/test').Page,
  role: 'customer' | 'staff' | 'admin'
) {
  const credentials = {
    customer: { email: 'customer@test.com', redirect: /customer\/dashboard/ },
    staff: { email: 'staff@test.com', redirect: /staff\/dashboard/ },
    admin: { email: 'admin@test.com', redirect: /admin\/dashboard/ },
  }
  
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill(credentials[role].email)
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(credentials[role].redirect, { timeout: 15000 })
}

test.describe('Customer 端到端流程', () => {
  test('客户可以完成 Dashboard -> Chat -> 发送消息 流程', async ({ page }) => {
    // 1. 登录
    await loginAs(page, 'customer')
    
    // 2. 点击 Start chat 进入对话
    await page.getByRole('button', { name: /start chat/i }).click()
    await expect(page).toHaveURL(/customer\/conversations/)
    
    // 3. 等待 AI 助手加载
    await expect(page.getByRole('heading', { name: /ai assistant/i })).toBeVisible({ timeout: 10000 })
    
    // 4. 输入消息并发送
    const messageInput = page.getByPlaceholder(/ask the ai/i)
    await messageInput.fill('Hello, I need help')
    await page.getByRole('button', { name: /send/i }).click()
    
    // 5. 验证消息出现在对话中
    await expect(page.locator('.message, [class*="message"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('客户可以完成 Dashboard -> FAQ 流程', async ({ page }) => {
    // 1. 登录
    await loginAs(page, 'customer')
    
    // 2. 点击 Browse FAQ
    await page.getByRole('button', { name: /browse faq/i }).click()
    
    // 3. 验证进入 FAQ 页面
    await expect(page).toHaveURL(/customer\/faq/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('客户可以完成 Dashboard -> 创建工单 流程', async ({ page }) => {
    // 1. 登录
    await loginAs(page, 'customer')
    
    // 2. 点击 Create ticket
    await page.getByRole('button', { name: /create ticket/i }).click()
    
    // 3. 验证进入工单创建页面
    await expect(page).toHaveURL(/customer\/my-tickets\/create/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('跨角色访问控制', () => {
  test('Customer 访问 Staff 页面受限', async ({ page }) => {
    await loginAs(page, 'customer')
    
    // 尝试访问 Staff 页面
    await page.goto('/staff/dashboard')
    await page.waitForTimeout(2000)
    
    // 验证：被重定向、显示错误、或页面不显示 Staff 内容
    const currentUrl = page.url()
    const wasRedirected = !currentUrl.endsWith('/staff/dashboard')
    const hasError = await page.getByText(/unauthorized|forbidden|access denied|not allowed/i).isVisible().catch(() => false)
    const noStaffContent = !(await page.getByText(/staff dashboard/i).isVisible().catch(() => false))
    
    // 只要不能正常访问 Staff Dashboard 即可
    expect(wasRedirected || hasError || noStaffContent).toBe(true)
  })

  test('Customer 访问 Admin 页面受限', async ({ page }) => {
    await loginAs(page, 'customer')
    
    // 尝试访问 Admin 页面
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(2000)
    
    const currentUrl = page.url()
    const wasRedirected = !currentUrl.endsWith('/admin/dashboard')
    const hasError = await page.getByText(/unauthorized|forbidden|access denied|not allowed/i).isVisible().catch(() => false)
    const noAdminContent = !(await page.getByRole('heading', { level: 1 }).filter({ hasText: /welcome/i }).isVisible().catch(() => false))
    
    expect(wasRedirected || hasError || noAdminContent).toBe(true)
  })

  test('Staff 访问 Admin 页面受限', async ({ page }) => {
    await loginAs(page, 'staff')
    
    // 尝试访问 Admin 页面
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(2000)
    
    const currentUrl = page.url()
    const wasRedirected = !currentUrl.endsWith('/admin/dashboard')
    const hasError = await page.getByText(/unauthorized|forbidden|access denied|not allowed/i).isVisible().catch(() => false)
    const noAdminContent = !(await page.getByRole('heading', { level: 1 }).filter({ hasText: /welcome/i }).isVisible().catch(() => false))
    
    expect(wasRedirected || hasError || noAdminContent).toBe(true)
  })
})

test.describe('响应式设计', () => {
  test('移动端 (375px) 登录页面正常工作', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/auth/login')
    
    // 验证登录表单元素都可见且可操作
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('平板端 (768px) Dashboard 正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await loginAs(page, 'customer')
    
    // 验证页面内容正常显示
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('错误处理', () => {
  test('访问不存在页面会被处理', async ({ page }) => {
    const response = await page.goto('/non-existent-page-12345')
    await page.waitForLoadState('networkidle')
    
    // 验证：404 页面、重定向到登录、或其他错误处理
    const currentUrl = page.url()
    const is404Page = await page.getByText(/404|not found|page.*not.*exist/i).isVisible().catch(() => false)
    const isRedirected = currentUrl.includes('login') || currentUrl.includes('auth')
    const isErrorStatus = response?.status() === 404 || response?.status() === 302
    
    expect(is404Page || isRedirected || isErrorStatus).toBe(true)
  })

  test('登录失败保持在登录页', async ({ page }) => {
    await page.goto('/auth/login')
    
    // 填写错误的凭据
    await page.getByRole('textbox', { name: /email/i }).fill('wrong@test.com')
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // 等待请求完成
    await page.waitForTimeout(2000)
    
    // 应该保持在登录页
    expect(page.url()).toMatch(/auth\/login/)
  })
})

test.describe('页面加载性能', () => {
  test('登录页面应该在合理时间内加载', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/auth/login')
    await page.waitForLoadState('domcontentloaded')
    
    const loadTime = Date.now() - startTime
    // 允许 5 秒（考虑到 CI 环境可能较慢）
    expect(loadTime).toBeLessThan(5000)
  })

  test('Dashboard 应该在 5 秒内加载', async ({ page }) => {
    await loginAs(page, 'customer')
    
    const startTime = Date.now()
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000)
  })
})
