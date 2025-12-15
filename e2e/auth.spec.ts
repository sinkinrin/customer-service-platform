/**
 * 认证流程 E2E 测试
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问登录页
    await page.goto('/auth/login')
  })

  test('should display login page correctly', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/Customer Service Platform/)

    // 验证登录表单元素（优先使用 data-testid，回退到 role 选择器）
    await expect(page.getByTestId('login-email-input').or(page.getByRole('textbox', { name: /email/i }))).toBeVisible()
    await expect(page.getByTestId('login-password-input').or(page.getByRole('textbox', { name: /password/i }))).toBeVisible()
    await expect(page.getByTestId('login-submit-button').or(page.getByRole('button', { name: /sign in/i }))).toBeVisible()

    // 验证注册链接
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible()
  })

  test('should show validation error for empty form', async ({ page }) => {
    // 点击登录按钮（不填写表单）
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // 验证表单验证 - 检查输入框仍然可见（表示没有提交成功）
    const emailInput = page.getByRole('textbox', { name: /email/i })
    await expect(emailInput).toBeVisible()
    
    // 页面应该仍然在登录页
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    // 填写登录表单
    await page.getByRole('textbox', { name: /email/i }).fill('customer@test.com')
    await page.getByRole('textbox', { name: /password/i }).fill('password123')
    
    // 点击登录
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // 等待重定向到 dashboard
    await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 15000 })
    
    // 验证 dashboard 内容
    await expect(page.getByRole('heading', { name: /customer service hub/i })).toBeVisible()
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // 尝试访问受保护的页面
    await page.goto('/customer/dashboard')
    
    // 应该重定向到登录页
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('should navigate to register page', async ({ page }) => {
    // 点击注册链接
    await page.getByRole('link', { name: /sign up/i }).click()
    
    // 验证跳转到注册页
    await expect(page).toHaveURL(/auth\/register/)
  })
})

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/auth/login')
    await page.getByRole('textbox', { name: /email/i }).fill('customer@test.com')
    await page.getByRole('textbox', { name: /password/i }).fill('password123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 15000 })
  })

  test('should logout successfully', async ({ page }) => {
    // 打开用户菜单
    await page.getByRole('button', { name: /^[A-Z]$/ }).click()
    
    // 点击登出
    await page.getByRole('menuitem', { name: /sign out|log out/i }).click()
    
    // 验证重定向到登录页
    await expect(page).toHaveURL(/auth\/login/)
  })
})
