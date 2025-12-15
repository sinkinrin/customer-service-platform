/**
 * Customer Portal E2E 测试
 * 
 * 基于真实 UI 结构编写的测试
 * - 页面标题: "Customer Service Hub"
 * - 卡片标题: "Live chat", "Browse knowledge base", "Submit a ticket"
 * - 按钮: "Start chat", "Browse FAQ", "Create ticket"
 */

import { test, expect } from '@playwright/test'

// 登录辅助函数
async function loginAsCustomer(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('customer@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 15000 })
}

test.describe('Customer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test('should display main heading', async ({ page }) => {
    // 验证主标题 - 真实文本: "Customer Service Hub"
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/customer service hub/i)
  })

  test('should display get started section with action cards', async ({ page }) => {
    // 验证 "Get started" 卡片区域
    await expect(page.getByText(/get started/i)).toBeVisible()
    
    // 验证三个功能卡片的标题 (h3)
    // 真实文本: "Live chat", "Browse knowledge base", "Submit a ticket"
    const headings = page.locator('h3')
    await expect(headings.filter({ hasText: /live chat/i })).toBeVisible()
    await expect(headings.filter({ hasText: /knowledge base/i })).toBeVisible()
    await expect(headings.filter({ hasText: /ticket/i })).toBeVisible()
  })

  test('should have start chat button that navigates to conversations', async ({ page }) => {
    // 点击 "Start chat" 按钮
    await page.getByRole('button', { name: /start chat/i }).click()
    
    // 验证跳转到对话页面
    await expect(page).toHaveURL(/customer\/conversations/)
  })

  test('should have browse FAQ button that navigates to FAQ page', async ({ page }) => {
    // 点击 "Browse FAQ" 按钮
    await page.getByRole('button', { name: /browse faq/i }).click()
    
    // 验证跳转到 FAQ 页面
    await expect(page).toHaveURL(/customer\/faq/)
  })

  test('should have create ticket button that navigates to ticket creation', async ({ page }) => {
    // 点击 "Create ticket" 按钮
    await page.getByRole('button', { name: /create ticket/i }).click()
    
    // 验证跳转到工单创建页面
    await expect(page).toHaveURL(/customer\/my-tickets\/create/)
  })
})

test.describe('Customer Conversations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    // 通过 Start chat 按钮进入对话（会自动创建/加入对话）
    // 优先使用 data-testid，回退到 role 选择器
    const startChatButton = page.getByTestId('start-chat-button').or(page.getByRole('button', { name: /start chat/i }))
    await startChatButton.click()
    // 等待重定向到具体对话页面
    await expect(page).toHaveURL(/customer\/conversations\//, { timeout: 15000 })
  })

  test('should display conversation interface', async ({ page }) => {
    // 等待页面内容加载完成（使用 waitForLoadState 替代 waitForTimeout）
    await page.waitForLoadState('networkidle')

    // 验证对话页面有标题或消息区域
    const hasHeading = await page.getByRole('heading').count()
    expect(hasHeading).toBeGreaterThan(0)
  })

  test('should have message input area', async ({ page }) => {
    // 等待页面加载完成
    await page.waitForLoadState('networkidle')

    // 验证消息输入区域存在（textarea 或 input）
    const messageInput = page.getByRole('textbox').or(page.locator('textarea'))
    await expect(messageInput.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Customer FAQ Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/faq')
  })

  test('should display FAQ page with search', async ({ page }) => {
    // 验证 FAQ 页面加载
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
    
    // 验证搜索功能存在
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await expect(searchInput).toBeVisible()
  })
})

test.describe('Customer Tickets Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets')
  })

  test('should display my tickets page', async ({ page }) => {
    // 验证工单列表页面
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should display ticket page content', async ({ page }) => {
    // 等待页面加载完成（使用 waitForLoadState 替代 waitForTimeout）
    await page.waitForLoadState('networkidle')

    // 验证页面有标题
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
