/**
 * MSW Server 配置
 * 用于 Node.js 环境（单元测试和 API 测试）
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// 创建 MSW 服务器实例
export const server = setupServer(...handlers)
