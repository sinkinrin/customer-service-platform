/**
 * 通知系统 E2E 测试
 *
 * 测试通知中心 UI、通知 API、标记已读等功能
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

test.describe('通知中心 UI - Customer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test('应该在导航栏显示通知图标', async ({ page }) => {
    // 查找铃铛图标按钮
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await expect(bellButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('点击通知图标应该打开通知面板', async ({ page }) => {
    // 点击通知图标
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await bellButton.first().click()

    // 等待下拉菜单出现
    const dropdown = page.locator('[role="menu"]').or(page.locator('[data-radix-menu-content]'))
    await expect(dropdown).toBeVisible({ timeout: 5000 })
  })

  test('通知面板应该有标题和"全部标记已读"按钮', async ({ page }) => {
    // 打开通知面板
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await bellButton.first().click()

    // 验证标题
    await expect(page.getByText(/notifications|通知/i).first()).toBeVisible()

    // 验证"标记全部已读"按钮
    const markAllButton = page.getByRole('button', { name: /mark all|全部已读/i })
    await expect(markAllButton).toBeVisible()
  })

  test('无通知时应该显示空状态', async ({ page }) => {
    // 打开通知面板
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await bellButton.first().click()

    // 等待加载完成
    await page.waitForTimeout(1000)

    // 如果没有通知，应该显示空状态
    const emptyState = page.getByTestId('empty-state')
      .or(page.getByText(/no notifications|暂无通知|empty/i))

    // 要么有通知，要么显示空状态
    const hasNotifications = await page.locator('[data-notification-item]').count() > 0
    if (!hasNotifications) {
      await expect(emptyState.first()).toBeVisible()
    }
  })
})

test.describe('通知中心 UI - Staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
  })

  test('Staff 页面应该有通知图标', async ({ page }) => {
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await expect(bellButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('通知面板功能正常', async ({ page }) => {
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await bellButton.first().click()

    // 验证面板打开
    const dropdown = page.locator('[role="menu"]').or(page.locator('[data-radix-menu-content]'))
    await expect(dropdown).toBeVisible({ timeout: 5000 })
  })
})

test.describe('通知中心 UI - Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Admin 页面应该有通知图标', async ({ page }) => {
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await expect(bellButton.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('通知 API', () => {
  test('Customer 应该能获取通知列表', async ({ page }) => {
    await loginAsCustomer(page)

    const response = await page.request.get('/api/notifications')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.notifications).toBeDefined()
    expect(Array.isArray(data.data.notifications)).toBe(true)
  })

  test('Staff 应该能获取通知列表', async ({ page }) => {
    await loginAsStaff(page)

    const response = await page.request.get('/api/notifications')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
  })

  test('应该能获取未读通知数量', async ({ page }) => {
    await loginAsCustomer(page)

    const response = await page.request.get('/api/notifications/unread-count')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(typeof data.data.unreadCount).toBe('number')
  })

  test('应该支持分页参数', async ({ page }) => {
    await loginAsCustomer(page)

    const response = await page.request.get('/api/notifications?limit=5&offset=0')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.notifications.length).toBeLessThanOrEqual(5)
  })

  test('应该能过滤未读通知', async ({ page }) => {
    await loginAsCustomer(page)

    const response = await page.request.get('/api/notifications?unread=true')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    // 所有返回的通知应该都是未读的
    for (const notification of data.data.notifications) {
      expect(notification.read).toBe(false)
    }
  })

  test('未认证用户应该返回 401', async ({ page }) => {
    // 不登录直接访问 API
    const response = await page.request.get('/api/notifications')
    expect(response.status()).toBe(401)
  })
})

test.describe('通知标记已读', () => {
  test('应该能标记全部通知为已读', async ({ page }) => {
    await loginAsCustomer(page)

    // 调用标记全部已读 API
    const response = await page.request.put('/api/notifications/read-all')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
  })

  test('标记全部已读后未读数应为 0', async ({ page }) => {
    await loginAsCustomer(page)

    // 标记全部已读
    await page.request.put('/api/notifications/read-all')

    // 获取未读数
    const response = await page.request.get('/api/notifications/unread-count')
    const data = await response.json()

    expect(data.data.unreadCount).toBe(0)
  })
})

test.describe('通知 Badge 显示', () => {
  test('未读通知数应该正确显示在 Badge 上', async ({ page }) => {
    await loginAsCustomer(page)

    // 获取未读数
    const response = await page.request.get('/api/notifications/unread-count')
    const data = await response.json()
    const unreadCount = data.data.unreadCount

    // 如果有未读通知，Badge 应该显示
    if (unreadCount > 0) {
      const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
      await expect(bellButton.first()).toBeVisible()

      // Badge 应该显示数字
      const badge = bellButton.first().locator('[class*="badge"], [class*="Badge"]')
      if (await badge.isVisible()) {
        const badgeText = await badge.textContent()
        if (unreadCount > 99) {
          expect(badgeText).toBe('99+')
        } else {
          expect(badgeText).toBe(String(unreadCount))
        }
      }
    }
  })
})

test.describe('通知响应式设计', () => {
  test('移动端通知图标应该正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsCustomer(page)

    // 铃铛图标应该可见
    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await expect(bellButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('移动端通知面板应该正常打开', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsCustomer(page)

    const bellButton = page.locator('button').filter({ has: page.locator('svg.lucide-bell') })
    await bellButton.first().click()

    // 面板应该正常显示
    const dropdown = page.locator('[role="menu"]').or(page.locator('[data-radix-menu-content]'))
    await expect(dropdown).toBeVisible({ timeout: 5000 })
  })
})
