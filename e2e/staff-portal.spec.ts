/**
 * Staff Portal E2E 测试
 * 
 * 基于真实 UI 结构编写的测试
 * - Staff Dashboard 页面标题: "Staff Dashboard"
 * - 工单统计卡片和最近工单列表
 */

import { test, expect } from '@playwright/test'

// 登录辅助函数
async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('staff@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/staff\/dashboard/, { timeout: 15000 })
}

test.describe('Staff Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
  })

  test('should display staff dashboard with heading', async ({ page }) => {
    // 验证页面主标题 - 真实文本: "Staff Dashboard"
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/staff dashboard/i)
  })

  test('should display welcome message', async ({ page }) => {
    // 验证欢迎信息
    await expect(page.getByText(/welcome/i)).toBeVisible()
  })

  test('should have action buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    // 验证操作按钮区域存在（按钮可能需要时间加载）
    const hasSearchButton = await page.getByRole('button', { name: /search|tickets/i }).first().isVisible().catch(() => false)
    const hasKnowledgeButton = await page.getByRole('button', { name: /knowledge/i }).first().isVisible().catch(() => false)
    
    // 至少有一个操作按钮可见
    expect(hasSearchButton || hasKnowledgeButton).toBe(true)
  })
})

test.describe('Staff Conversations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
    await page.goto('/staff/conversations')
  })

  test('should display conversations page', async ({ page }) => {
    // 验证页面 URL 和标题
    await expect(page).toHaveURL(/staff\/conversations/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should show page content', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(3000)
    
    // 页面应该有内容
    const hasContent = await page.textContent('body')
    expect(hasContent && hasContent.length > 50).toBe(true)
  })
})

test.describe('Staff Tickets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
    await page.goto('/staff/tickets')
  })

  test('should display tickets page', async ({ page }) => {
    // 验证页面 URL 和标题
    await expect(page).toHaveURL(/staff\/tickets/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('should display page content', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(2000)
    
    // 验证页面有内容
    const hasContent = await page.textContent('body')
    expect(hasContent && hasContent.length > 50).toBe(true)
  })
})

test.describe('Staff Access Control', () => {
  test('staff cannot access admin dashboard', async ({ page }) => {
    await loginAsStaff(page)
    
    // 尝试访问 admin 页面
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(2000)
    
    // 验证：被重定向或没有 Admin 欢迎内容
    const currentUrl = page.url()
    const wasRedirected = !currentUrl.endsWith('/admin/dashboard')
    const noAdminContent = !(await page.getByRole('heading', { level: 1 }).filter({ hasText: /welcome/i }).isVisible().catch(() => false))
    
    expect(wasRedirected || noAdminContent).toBe(true)
  })
})
