/**
 * 安全场景测试
 * 
 * 模拟恶意用户或越权访问场景：
 * 1. 客户尝试访问其他客户的数据
 * 2. 客服尝试访问其他区域的数据
 * 3. 普通用户尝试访问管理员功能
 */

import { describe, it, expect } from 'vitest'
import {
  hasRegionAccess,
  hasGroupAccess,
  hasConversationRegionAccess,
  filterConversationsByRegion,
  filterTicketsByRegion,
  validateTicketAccess,
  validateConversationAccess,
} from '@/lib/utils/region-auth'

describe('Security: 越权访问防护', () => {
  const customerA = {
    id: 'cust_a',
    email: 'customer_a@test.com',
    role: 'customer' as const,
    region: 'asia-pacific',
  }

  const customerB = {
    id: 'cust_b',
    email: 'customer_b@test.com',
    role: 'customer' as const,
    region: 'europe-zone-1',
  }

  const staffAsia = {
    id: 'staff_asia',
    email: 'staff@test.com',
    role: 'staff' as const,
    region: 'asia-pacific',
  }

  describe('场景1: 客户数据隔离', () => {
    it('客户 A 不能访问客户 B 的对话', () => {
      const customerBConversation = {
        id: 'conv_b',
        region: 'europe-zone-1' as const,
        customer_email: customerB.email,
      }

      const hasAccess = hasConversationRegionAccess(customerA, customerBConversation)

      expect(hasAccess).toBe(false)
    })

    it('客户只能看到自己的对话列表', () => {
      const allConversations = [
        { id: 'conv_a1', region: 'asia-pacific' as const, customer_email: customerA.email },
        { id: 'conv_a2', region: 'asia-pacific' as const, customer_email: customerA.email },
        { id: 'conv_b1', region: 'europe-zone-1' as const, customer_email: customerB.email },
      ]

      const customerAConvs = filterConversationsByRegion(allConversations, customerA)

      expect(customerAConvs.length).toBe(2)
      expect(customerAConvs.every(c => c.customer_email === customerA.email)).toBe(true)
    })

    it('客户不能通过修改 URL 参数访问其他客户的对话', () => {
      // 模拟：客户 A 尝试访问 conv_b（属于客户 B）
      const targetConversation = {
        id: 'conv_b',
        region: 'europe-zone-1' as const,
        customer_email: customerB.email,
      }

      // 验证访问权限
      expect(() => {
        validateConversationAccess(customerA, targetConversation)
      }).toThrow()
    })
  })

  describe('场景2: 客服区域限制', () => {
    it('亚太区客服不能访问欧洲区工单', () => {
      const europeGroupId = 3 // europe-zone-1

      expect(hasGroupAccess(staffAsia, europeGroupId)).toBe(false)
    })

    it('客服尝试访问其他区域工单时应该抛出错误', () => {
      const europeGroupId = 3

      expect(() => {
        validateTicketAccess(staffAsia, europeGroupId)
      }).toThrow(/permission/)
    })

    it('客服不能通过 API 直接修改其他区域的对话', () => {
      const europeConversation = {
        id: 'conv_eu',
        region: 'europe-zone-1' as const,
        customer_email: 'eu_customer@test.com',
      }

      expect(() => {
        validateConversationAccess(staffAsia, europeConversation)
      }).toThrow()
    })
  })

  describe('场景3: 角色权限边界', () => {
    it('客户不能访问客服专用的 group', () => {
      // 客户只能访问 group 1 (Users)
      expect(hasGroupAccess(customerA, 1)).toBe(true)
      expect(hasGroupAccess(customerA, 5)).toBe(false) // asia-pacific staff group
    })

    it('客服不能访问管理员专用功能', () => {
      // 客服只能访问自己区域的 group
      // 不能访问所有 8 个 group（只有管理员可以）
      const allGroups = [1, 2, 3, 4, 5, 6, 7, 8]
      const accessibleGroups = allGroups.filter(g => hasGroupAccess(staffAsia, g))

      expect(accessibleGroups.length).toBeLessThan(8)
    })
  })

  describe('场景4: 数据篡改防护', () => {
    it('过滤函数应该正确过滤掉无权访问的数据', () => {
      const mixedTickets = [
        { id: 1, group_id: 5, customer_id: 1 },  // asia-pacific - 可访问
        { id: 2, group_id: 3, customer_id: 2 },  // europe - 不可访问
        { id: 3, group_id: 1, customer_id: 3 },  // Users - 可访问
        { id: 4, group_id: 7, customer_id: 4 },  // north-america - 不可访问
      ]

      const filtered = filterTicketsByRegion(mixedTickets, staffAsia)

      // 确保不可访问的数据被过滤
      expect(filtered.some(t => t.group_id === 3)).toBe(false)
      expect(filtered.some(t => t.group_id === 7)).toBe(false)
    })

    it('即使传入恶意构造的数据也应该正确过滤', () => {
      const maliciousData = [
        { id: 1, group_id: 5, customer_id: 1 },
        { id: 2, group_id: undefined, customer_id: 2 },  // 缺少 group_id
        { id: 3, group_id: null as any, customer_id: 3 },  // null group_id
        { id: 4, group_id: -1, customer_id: 4 },  // 无效 group_id
      ]

      const filtered = filterTicketsByRegion(maliciousData, staffAsia)

      // 只有有效的、有权限的数据应该通过
      expect(filtered.length).toBe(1)
      expect(filtered[0].group_id).toBe(5)
    })
  })

  describe('场景5: 会话劫持防护', () => {
    it('同一客户的不同对话应该独立验证', () => {
      const conversation1 = {
        id: 'conv_1',
        region: 'asia-pacific' as const,
        customer_email: customerA.email,
      }

      const conversation2 = {
        id: 'conv_2',
        region: 'asia-pacific' as const,
        customer_email: customerA.email,
      }

      // 客户 A 可以访问自己的两个对话
      expect(hasConversationRegionAccess(customerA, conversation1)).toBe(true)
      expect(hasConversationRegionAccess(customerA, conversation2)).toBe(true)

      // 但客户 B 不能访问
      expect(hasConversationRegionAccess(customerB, conversation1)).toBe(false)
      expect(hasConversationRegionAccess(customerB, conversation2)).toBe(false)
    })
  })
})

describe('Security: 输入验证', () => {
  it('Schema 应该拒绝过长的输入', async () => {
    const { CreateMessageSchema } = await import('@/types/api.types')

    const result = CreateMessageSchema.safeParse({
      conversation_id: 'conv_1',
      content: 'a'.repeat(10000), // 超过 5000 字符限制
      message_type: 'text',
    })

    expect(result.success).toBe(false)
  })

  it('Schema 应该拒绝无效的枚举值', async () => {
    const { CreateMessageSchema } = await import('@/types/api.types')

    const result = CreateMessageSchema.safeParse({
      conversation_id: 'conv_1',
      content: 'test',
      message_type: 'invalid_type', // 无效的消息类型
    })

    expect(result.success).toBe(false)
  })

  it('Schema 应该拒绝缺少必填字段', async () => {
    const { CreateMessageSchema } = await import('@/types/api.types')

    const result = CreateMessageSchema.safeParse({
      // 缺少 conversation_id 和 content
      message_type: 'text',
    })

    expect(result.success).toBe(false)
  })
})
