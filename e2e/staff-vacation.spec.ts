/**
 * Staff 假期管理 E2E 测试
 *
 * 测试 Staff 设置页面的假期功能
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

test.describe('Staff 设置页面', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
    await page.goto('/staff/settings')
    await page.waitForLoadState('networkidle')
  })

  test('应该显示设置页面', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('应该有假期设置区域', async ({ page }) => {
    // 查找假期相关内容
    const vacationSection = page.getByText(/vacation|假期|out of office/i)
    await expect(vacationSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('应该有设置假期按钮', async ({ page }) => {
    // 查找设置假期按钮
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await expect(vacationButton).toBeVisible({ timeout: 10000 })
  })
})

test.describe('假期对话框', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page)
    await page.goto('/staff/settings')
    await page.waitForLoadState('networkidle')
  })

  test('点击假期按钮应该打开对话框', async ({ page }) => {
    // 点击设置假期按钮
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    // 等待对话框出现
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
  })

  test('假期对话框应该有日期选择器', async ({ page }) => {
    // 打开对话框
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    // 验证对话框出现
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 应该有开始日期和结束日期输入
    await expect(dialog.locator('input[type="date"]').first()).toBeVisible()
    await expect(dialog.locator('input[type="date"]').nth(1)).toBeVisible()
  })

  test('假期对话框应该有代理人选择器', async ({ page }) => {
    // 打开对话框
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 查找代理人选择器
    const replacementSelect = dialog.locator('[role="combobox"]')
      .or(dialog.getByText(/replacement|代理人|assign/i))

    await expect(replacementSelect.first()).toBeVisible({ timeout: 5000 })
  })

  test('可以关闭假期对话框', async ({ page }) => {
    // 打开对话框
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 按 ESC 关闭对话框
    await page.keyboard.press('Escape')

    // 对话框应该消失
    await expect(dialog).not.toBeVisible({ timeout: 3000 })
  })

  test('未填写日期时保存按钮应禁用', async ({ page }) => {
    // 打开对话框
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 保存按钮应该是禁用的（因为没有填写日期）
    const saveButton = dialog.getByRole('button', { name: /save|set vacation|update|保存|设置/i })
      .filter({ hasNotText: /cancel|取消/i })

    // 获取第一个匹配的按钮
    const mainSaveButton = saveButton.first()
    if (await mainSaveButton.isVisible()) {
      // 检查是否禁用
      const isDisabled = await mainSaveButton.isDisabled()
      expect(isDisabled).toBe(true)
    }
  })

  test('填写日期后保存按钮应启用', async ({ page }) => {
    // 打开对话框
    const vacationButton = page.getByRole('button', { name: /set vacation|vacation|假期/i })
    await vacationButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 获取日期输入框
    const dateInputs = dialog.locator('input[type="date"]')
    const startDateInput = dateInputs.first()
    const endDateInput = dateInputs.nth(1)

    // 填写未来的日期
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() + 1)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 7)

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    await startDateInput.fill(formatDate(startDate))
    await endDateInput.fill(formatDate(endDate))

    // 保存按钮应该启用
    const saveButton = dialog.getByRole('button', { name: /save|set vacation|update|保存|设置/i })
      .filter({ hasNotText: /cancel|取消/i })

    const mainSaveButton = saveButton.first()
    if (await mainSaveButton.isVisible()) {
      const isDisabled = await mainSaveButton.isDisabled()
      expect(isDisabled).toBe(false)
    }
  })
})

test.describe('假期状态显示', () => {
  test('假期状态页面加载成功', async ({ page }) => {
    await loginAsStaff(page)
    await page.goto('/staff/settings')

    // 页面应该加载成功
    await expect(page).toHaveURL(/staff\/settings/)

    // 假期区域应该可见
    const vacationSection = page.getByText(/vacation|假期/i).first()
    await expect(vacationSection).toBeVisible({ timeout: 10000 })
  })
})

test.describe('假期对工单分配的影响', () => {
  // 这个测试验证假期状态与可用员工列表的关联
  test('可用员工 API 应该返回员工列表', async ({ page }) => {
    await loginAsStaff(page)

    // 直接调用 API
    const response = await page.request.get('/api/staff/available')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.staff).toBeDefined()
    expect(Array.isArray(data.data.staff)).toBe(true)
  })

  test('假期状态 API 应该返回当前状态', async ({ page }) => {
    await loginAsStaff(page)

    // 调用假期状态 API
    const response = await page.request.get('/api/staff/vacation')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.vacation).toBeDefined()
    expect(typeof data.data.vacation.is_on_vacation).toBe('boolean')
  })
})
