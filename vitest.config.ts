import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // 测试环境
    environment: 'jsdom',
    
    // 全局设置
    globals: true,
    
    // 设置文件
    setupFiles: ['./__tests__/setup.ts'],
    
    // 包含的测试文件
    include: [
      '__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    
    // 排除的文件
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'e2e/**/*',
    ],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        '__tests__/',
        'e2e/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
    
    // 报告器
    reporters: ['default', 'html', 'junit'],
    outputFile: {
      html: './test-results/html/index.html',
      junit: './test-results/junit.xml',
    },
    
    // 超时设置
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  
  // 路径别名（与 tsconfig 保持一致）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './__tests__'),
    },
  },
})
