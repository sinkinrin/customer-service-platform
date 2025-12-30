/**
 * 客服工作流程测试
 * 
 * 模拟真实客服场景：
 * 1. 客服上班，查看待处理队列
 * 2. 接单处理客户问题
 * 3. 需要时转给其他区域客服
 * 4. 处理完成，记录工单
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasRegionAccess,
  hasConversationRegionAccess,
  filterConversationsByRegion,
  filterTicketsByRegion,
} from '@/lib/utils/region-auth'
import { getGroupIdByRegion } from '@/lib/constants/regions'

describe('Staff Workflow: 客服日常工作', () => {
  // 模拟不同区域的客服
  const staffAsia = {
    id: 'staff_asia_001',
    email: 'li.kefu@company.com',
    name: '李客服',
    role: 'staff' as const,
    region: 'asia-pacific',
  }

  const staffEurope = {
    id: 'staff_eu_001',
    email: 'john.support@company.com',
    name: 'John Support',
    role: 'staff' as const,
    region: 'europe-zone-1',
  }

  const admin = {
    id: 'admin_001',
    email: 'admin@company.com',
    name: '管理员',
    role: 'admin' as const,
  }

  describe('场景1: 客服查看工作队列', () => {
    it('亚太区客服只能看到亚太区的对话', () => {
      const allConversations = [
        { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
        { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'b@test.com' },
        { id: 'conv_3', region: 'asia-pacific' as const, customer_email: 'c@test.com' },
        { id: 'conv_4', region: 'north-america' as const, customer_email: 'd@test.com' },
      ]

      const visibleConvs = filterConversationsByRegion(allConversations, staffAsia)

      expect(visibleConvs.length).toBe(2)
      expect(visibleConvs.every(c => c.region === 'asia-pacific')).toBe(true)
    })

    it('欧洲区客服不能看到亚太区的对话', () => {
      const asiaConversation = {
        id: 'conv_1',
        region: 'asia-pacific' as const,
        customer_email: 'customer@test.com',
      }

      const hasAccess = hasConversationRegionAccess(staffEurope, asiaConversation)

      expect(hasAccess).toBe(false)
    })

    it('管理员可以看到所有区域的对话', () => {
      const allConversations = [
        { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
        { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'b@test.com' },
        { id: 'conv_3', region: 'north-america' as const, customer_email: 'c@test.com' },
      ]

      const visibleConvs = filterConversationsByRegion(allConversations, admin)

      expect(visibleConvs.length).toBe(3)
    })

    it('客服能看到没有区域标记的历史对话（兼容旧数据）', () => {
      const conversations = [
        { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
        { id: 'conv_2', customer_email: 'b@test.com' }, // 没有 region，旧数据
      ]

      const visibleConvs = filterConversationsByRegion(conversations, staffAsia)

      // 应该能看到旧数据
      expect(visibleConvs.length).toBe(2)
    })
  })

  describe('场景2: 客服处理工单', () => {
    it('亚太区客服只能处理亚太区工单', () => {
      const asiaGroupId = getGroupIdByRegion('asia-pacific')
      const europeGroupId = getGroupIdByRegion('europe-zone-1')
      const northAmericaGroupId = getGroupIdByRegion('north-america')

      const allTickets = [
        { id: 1, group_id: asiaGroupId, customer_id: 1 },
        { id: 2, group_id: 1, customer_id: 2 }, // legacy Users group (should be filtered out for staff)
        { id: 3, group_id: europeGroupId, customer_id: 3 },
        { id: 4, group_id: northAmericaGroupId, customer_id: 4 },
      ]

      const visibleTickets = filterTicketsByRegion(allTickets, staffAsia)

      expect(visibleTickets.length).toBe(1)
      expect(visibleTickets[0].group_id).toBe(asiaGroupId)
    })

    it('客服不能越权处理其他区域的工单', () => {
      const europeTicketGroupId = getGroupIdByRegion('europe-zone-1')

      const hasAccess = hasRegionAccess(staffAsia, 'europe-zone-1')

      expect(hasAccess).toBe(false)
    })
  })

  describe('场景3: 跨区域协作', () => {
    it('当客户问题需要其他区域处理时，应该能转交', () => {
      // 场景：亚太区客户的问题涉及欧洲仓库，需要欧洲客服协助
      const conversation = {
        id: 'conv_001',
        region: 'asia-pacific' as const,
        customer_email: 'customer@test.com',
        staff_id: staffAsia.id,
      }

      // 亚太客服有权限查看
      expect(hasConversationRegionAccess(staffAsia, conversation)).toBe(true)

      // 转交后，更新区域
      const transferredConversation = {
        ...conversation,
        region: 'europe-zone-1' as const,
        staff_id: staffEurope.id,
      }

      // 欧洲客服现在有权限
      expect(hasConversationRegionAccess(staffEurope, transferredConversation)).toBe(true)
      // 亚太客服失去权限
      expect(hasConversationRegionAccess(staffAsia, transferredConversation)).toBe(false)
    })

    it('管理员可以将任何对话转给任何区域', () => {
      const conversation = {
        id: 'conv_001',
        region: 'asia-pacific' as const,
        customer_email: 'customer@test.com',
      }

      // 管理员有所有区域权限
      expect(hasRegionAccess(admin, 'asia-pacific')).toBe(true)
      expect(hasRegionAccess(admin, 'europe-zone-1')).toBe(true)
      expect(hasRegionAccess(admin, 'north-america')).toBe(true)
    })
  })

  describe('场景4: 工作量统计', () => {
    it('客服只能看到自己区域的统计数据', () => {
      const allConversations = [
        { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com', status: 'active' },
        { id: 'conv_2', region: 'asia-pacific' as const, customer_email: 'b@test.com', status: 'closed' },
        { id: 'conv_3', region: 'europe-zone-1' as const, customer_email: 'c@test.com', status: 'active' },
      ]

      const asiaConvs = filterConversationsByRegion(allConversations, staffAsia)
      const activeCount = asiaConvs.filter(c => c.status === 'active').length
      const closedCount = asiaConvs.filter(c => c.status === 'closed').length

      expect(activeCount).toBe(1)
      expect(closedCount).toBe(1)
    })
  })

  describe('场景5: 边界情况', () => {
    it('新入职客服没有分配区域时不能看到任何对话', () => {
      const newStaff = {
        id: 'staff_new',
        email: 'new@company.com',
        role: 'staff' as const,
        // 没有 region
      }

      const conversations = [
        { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
      ]

      const visibleConvs = filterConversationsByRegion(conversations, newStaff)

      // 没有区域的客服只能看到没有区域的对话（旧数据）
      expect(visibleConvs.length).toBe(0)
    })

    it('客服离职后其处理的对话应该能被重新分配', () => {
      // 这是业务逻辑测试，验证数据结构支持重新分配
      const conversation = {
        id: 'conv_001',
        region: 'asia-pacific' as const,
        customer_email: 'customer@test.com',
        staff_id: 'resigned_staff',
        staff_name: '已离职客服',
      }

      // 管理员可以访问并重新分配
      expect(hasConversationRegionAccess(admin, conversation)).toBe(true)

      // 同区域其他客服可以接手
      expect(hasConversationRegionAccess(staffAsia, conversation)).toBe(true)
    })
  })
})

describe('Staff Workflow: 未读消息处理', () => {
  it('客服应该优先处理未读消息多的对话', async () => {
    const fs = await import('fs/promises')
    vi.mock('fs/promises', () => ({
      default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    }))

    const conversations = [
      {
        id: 'conv_1',
        customer_email: 'a@test.com',
        mode: 'human',
        status: 'active',
        region: 'asia-pacific',
        staff_id: 'staff_001',
        staff_unread_count: 5,
      },
      {
        id: 'conv_2',
        customer_email: 'b@test.com',
        mode: 'human',
        status: 'active',
        region: 'asia-pacific',
        staff_id: 'staff_001',
        staff_unread_count: 1,
      },
    ]

    // 按未读数排序
    const sorted = [...conversations].sort(
      (a, b) => (b.staff_unread_count || 0) - (a.staff_unread_count || 0)
    )

    expect(sorted[0].id).toBe('conv_1')
    expect(sorted[0].staff_unread_count).toBe(5)
  })
})
