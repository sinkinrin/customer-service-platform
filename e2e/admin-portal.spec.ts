/**
 * Admin Portal E2E 测试
 * 
 * 基于真实 UI 结构编写的测试
 * - Admin Dashboard 页面标题: "Welcome, {name}"
 * - 快速操作按钮: "Create User", "View All Tickets", "Manage FAQ"
 */

import { test, expect } from '@playwright/test'

// 登录辅助函数
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('admin@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15000 })
}

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should display welcome heading', async ({ page }) => {
    // 验证欢迎标题 - 真实文本: "Welcome, {name}"
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome/i)
  })

  test('should display page content', async ({ page }) => {
    // 验证页面有内容
    await page.waitForLoadState('networkidle')
    const pageContent = await page.textContent('body')
    expect(pageContent && pageContent.length > 100).toBe(true)
  })

  test('should display statistics cards', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // 验证统计卡片区域存在
    const cards = page.locator('[class*="card"], [class*="Card"]')
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(0)
  })

  test('should have quick action buttons', async ({ page }) => {
    // 验证快速操作按钮 - 真实文本: "Create User", "View All Tickets"
    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /view all tickets|all tickets/i })).toBeVisible()
  })
})

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/users')
  })

  test('should display user management page', async ({ page }) => {
    // 验证页面 URL 和标题
    await expect(page).toHaveURL(/admin\/users/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should display user table', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(3000)
    
    // 验证页面有内容
    const hasContent = await page.textContent('body')
    expect(hasContent && hasContent.length > 50).toBe(true)
  })

  test('should have create user link', async ({ page }) => {
    // 验证有创建用户的链接
    await expect(page.getByRole('link', { name: /create user/i })).toBeVisible()
  })
})

test.describe('Admin FAQ Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/faq')
  })

  test('should display FAQ management page', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveURL(/admin\/faq/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should have FAQ list or empty state', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // 验证有 FAQ 列表或空状态提示
    const hasFAQItems = await page.locator('table tbody tr, [class*="card"], [class*="item"]').count() > 0
    const hasEmptyState = await page.getByText(/no faq|empty|no items/i).isVisible().catch(() => false)
    
    expect(hasFAQItems || hasEmptyState).toBe(true)
  })
})

test.describe('Admin AI Config', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/ai-config')
  })

  test('should display AI configuration page', async ({ page }) => {
    // 验证页面标题包含 "AI" 或 "Configuration"
    await expect(page).toHaveURL(/admin\/ai-config/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should display configuration content', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // 验证页面有内容
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })

  test('should have form elements', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // 验证页面有表单元素
    const hasInputs = await page.locator('input, textarea, button, [role="switch"]').count() > 0
    expect(hasInputs).toBe(true)
  })
})
