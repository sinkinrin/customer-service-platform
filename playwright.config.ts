import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 测试文件匹配模式
  testMatch: '**/*.spec.ts',
  
  // 并行运行测试
  fullyParallel: true,
  
  // CI 环境下禁止 test.only
  forbidOnly: !!process.env.CI,
  
  // 失败重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并行 worker 数量
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
    ['list'],
  ],
  
  // 全局设置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:3010',

    // 收集失败测试的 trace
    trace: 'on-first-retry',

    // 截图设置
    screenshot: 'only-on-failure',

    // 视频设置
    video: 'on-first-retry',

    // 超时设置（优化：减少不必要的等待时间）
    actionTimeout: 8000,      // 从 10s 降到 8s，大多数操作应在此时间内完成
    navigationTimeout: 20000, // 从 30s 降到 20s，页面加载应更快
  },

  // 全局超时（优化：从 60s 降到 45s）
  timeout: 45000,

  // 期望超时（优化：从 10s 降到 8s）
  expect: {
    timeout: 8000,
  },
  
  // 项目配置（不同浏览器）
  projects: [
    // 桌面 Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // 桌面 Firefox（可选，CI 中可能禁用）
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    
    // 移动端 Chrome（可选）
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  
  // 开发服务器配置
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  // 输出目录
  outputDir: 'test-results/e2e',
})
