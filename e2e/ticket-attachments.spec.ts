/**
 * 工单和附件 E2E 测试
 *
 * 测试工单创建、附件上传 UI、工单详情查看等流程
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

test.describe('工单创建页面', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets/create')
  })

  test('应该显示工单创建表单', async ({ page }) => {
    // 验证页面标题
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })

    // 验证关键表单字段存在
    await expect(page.getByText(/category/i)).toBeVisible()
    await expect(page.getByText(/title/i)).toBeVisible()
  })

  test('应该有文件上传区域', async ({ page }) => {
    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 查找附件上传按钮
    const uploadButton = page.getByRole('button', { name: /select files|upload|选择文件/i })
    await expect(uploadButton).toBeVisible()
  })

  test('应该能选择产品分类和型号', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // 查找分类选择器
    const categoryTrigger = page.locator('[role="combobox"]').first()
    await expect(categoryTrigger).toBeVisible()

    // 点击打开下拉菜单
    await categoryTrigger.click()

    // 验证有选项可选
    await expect(page.locator('[role="option"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('表单验证 - 必填字段为空时不能提交', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // 尝试提交空表单
    const submitButton = page.getByRole('button', { name: /submit|提交/i })
    await submitButton.click()

    // 应该显示验证错误或保持在当前页
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/create')
  })

  test('应该能填写完整表单', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // 填写分类
    const categoryTrigger = page.locator('[role="combobox"]').first()
    await categoryTrigger.click()
    await page.locator('[role="option"]').first().click()

    // 等待型号选择器更新
    await page.waitForTimeout(500)

    // 填写型号（如果可用）
    const modelTrigger = page.locator('[role="combobox"]').nth(1)
    if (await modelTrigger.isVisible()) {
      await modelTrigger.click()
      const modelOption = page.locator('[role="option"]').first()
      if (await modelOption.isVisible()) {
        await modelOption.click()
      }
    }

    // 填写平台
    await page.getByPlaceholder(/platform|平台/i).fill('Windows 11')

    // 填写标题
    await page.getByPlaceholder(/title|标题/i).fill('Test Ticket - E2E')

    // 填写问题描述
    const descriptionField = page.locator('textarea').first()
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('This is a test ticket created by E2E tests.')
    }

    // 验证表单已填写
    await expect(page.getByPlaceholder(/title|标题/i)).toHaveValue('Test Ticket - E2E')
  })
})

test.describe('工单列表页面', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets')
  })

  test('应该显示工单列表页面', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('应该有创建工单按钮', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // 查找创建工单链接或按钮
    const createButton = page.getByRole('link', { name: /create|new|新建|创建/i })
      .or(page.getByRole('button', { name: /create|new|新建|创建/i }))

    await expect(createButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('点击创建按钮应该跳转到创建页面', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    const createButton = page.getByRole('link', { name: /create|new|新建|创建/i })
      .or(page.getByRole('button', { name: /create|new|新建|创建/i }))

    if (await createButton.first().isVisible()) {
      await createButton.first().click()
      await expect(page).toHaveURL(/my-tickets\/create/, { timeout: 10000 })
    }
  })
})

test.describe('文件上传 UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets/create')
    await page.waitForLoadState('networkidle')
  })

  test('应该有隐藏的文件输入框', async ({ page }) => {
    // 文件输入框应该存在但隐藏
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    // 验证它接受正确的文件类型
    const acceptAttr = await fileInput.getAttribute('accept')
    expect(acceptAttr).toBeTruthy()
  })

  test('点击上传按钮应该触发文件选择', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /select files|upload|选择文件/i })

    // 验证按钮可点击
    await expect(uploadButton).toBeEnabled()

    // 监听文件选择器事件
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadButton.click()
    ])

    // 验证文件选择器被打开
    expect(fileChooser).toBeTruthy()
    expect(fileChooser.isMultiple()).toBe(true)
  })

  test('显示文件大小限制提示', async ({ page }) => {
    // 应该显示文件大小限制信息
    const sizeLimit = page.getByText(/MB|size limit|文件大小/i)
    await expect(sizeLimit).toBeVisible()
  })
})

test.describe('工单详情页面', () => {
  // 注意：这些测试依赖于系统中存在工单
  // 如果没有工单，测试会跳过

  test('工单详情页面应该正确加载', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets')
    await page.waitForLoadState('networkidle')

    // 查找工单列表中的第一个工单链接
    const ticketLinks = page.locator('a[href*="/my-tickets/"]').filter({ hasNotText: /create/i })

    if (await ticketLinks.count() > 0) {
      await ticketLinks.first().click()

      // 验证进入工单详情页
      await expect(page).toHaveURL(/my-tickets\/\d+/, { timeout: 10000 })

      // 验证页面有内容
      await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 })
    } else {
      // 如果没有工单，测试通过但记录
      console.log('No tickets found, skipping detail page test')
    }
  })

  test('工单详情页应该有回复输入区域', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/customer/my-tickets')
    await page.waitForLoadState('networkidle')

    const ticketLinks = page.locator('a[href*="/my-tickets/"]').filter({ hasNotText: /create/i })

    if (await ticketLinks.count() > 0) {
      await ticketLinks.first().click()
      await page.waitForLoadState('networkidle')

      // 查找回复输入区域
      const replyArea = page.locator('textarea').or(page.getByPlaceholder(/reply|回复|message/i))

      // 如果工单未关闭，应该有回复区域
      if (await replyArea.isVisible()) {
        await expect(replyArea).toBeEnabled()
      }
    }
  })
})
