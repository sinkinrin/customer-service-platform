/**
 * 可访问性 (Accessibility) E2E 测试
 * 
 * 使用 axe-core 进行自动化可访问性检查
 * 符合 WCAG 2.1 AA 标准
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// 最大允许的可访问性违规数量（宽容模式）
const MAX_VIOLATIONS = 5

// 辅助函数：运行可访问性检查
async function runAccessibilityCheck(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  
  // 输出违规详情用于调试
  if (results.violations.length > 0) {
    console.log('Accessibility violations:', results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length
    })))
  }
  
  return results
}

// 登录辅助函数
async function loginAsCustomer(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('customer@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 15000 })
}

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('staff@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/staff\/dashboard/, { timeout: 15000 })
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/auth/login')
  await page.getByRole('textbox', { name: /email/i }).fill('admin@test.com')
  await page.getByRole('textbox', { name: /password/i }).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15000 })
}

test.describe('Accessibility: 公共页面', () => {
  test('登录页面可访问性检查', async ({ page }) => {
    await page.goto('/auth/login')
    
    const results = await runAccessibilityCheck(page)
    
    // 允许少量违规，但严重违规应该为0
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })

  test('注册页面可访问性检查', async ({ page }) => {
    await page.goto('/auth/register')
    
    const results = await runAccessibilityCheck(page)
    
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })
})

test.describe('Accessibility: Customer Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test('Customer Dashboard 可访问性检查', async ({ page }) => {
    const results = await runAccessibilityCheck(page)
    
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })

  test('对话页面可访问性检查', async ({ page }) => {
    await page.goto('/customer/conversations')
    await page.waitForLoadState('networkidle')
    
    const results = await runAccessibilityCheck(page)
    
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })
})

test.describe('Accessibility: Staff Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
  })

  test('Staff Dashboard 可访问性检查', async ({ page }) => {
    const results = await runAccessibilityCheck(page)
    
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })
})

test.describe('Accessibility: Admin Portal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Admin Dashboard 可访问性检查', async ({ page }) => {
    const results = await runAccessibilityCheck(page)
    
    const criticalViolations = results.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
    expect(results.violations.length).toBeLessThanOrEqual(MAX_VIOLATIONS)
  })
})

test.describe('Accessibility: 键盘导航', () => {
  test('登录页面支持键盘导航', async ({ page }) => {
    await page.goto('/auth/login')
    
    // 验证表单元素可以通过键盘访问
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const passwordInput = page.getByRole('textbox', { name: /password/i })
    const loginButton = page.getByRole('button', { name: /sign in/i })
    
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(loginButton).toBeVisible()
    
    // 测试 Tab 键导航 - 只验证元素可聚焦
    await emailInput.focus()
    await expect(emailInput).toBeFocused()
  })

  test('Dashboard 页面元素可聚焦', async ({ page }) => {
    await loginAsCustomer(page)
    
    // 验证页面有可聚焦的元素
    const focusableElements = page.locator('button, a, input, [tabindex="0"]')
    const count = await focusableElements.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Accessibility: 基础检查', () => {
  test('页面有主要内容区域', async ({ page }) => {
    await loginAsCustomer(page)
    
    // 检查页面有 main 或 heading
    const hasMain = await page.locator('main, [role="main"]').count() > 0
    const hasHeading = await page.getByRole('heading').first().isVisible()
    
    expect(hasMain || hasHeading).toBe(true)
  })

  test('图片有 alt 属性', async ({ page }) => {
    await loginAsCustomer(page)
    
    const images = page.locator('img')
    const count = await images.count()
    
    // 如果有图片，检查 alt 属性
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i)
        const alt = await img.getAttribute('alt')
        expect(alt).not.toBeNull()
      }
    }
  })
})
