/**
 * TicketDetail 组件测试
 *
 * 测试工单详情显示：
 * - 工单基本信息渲染（标题、编号、状态、优先级）
 * - 客户信息显示
 * - 时间戳格式化
 * - 状态和优先级颜色映射
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TicketDetail } from '@/components/ticket/ticket-detail'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

// 创建测试用的工单数据
const createMockTicket = (overrides: Partial<ZammadTicket> = {}): ZammadTicket => ({
  id: 1,
  number: '10001',
  title: 'Test Ticket Title',
  state: 'open',
  priority: '2 normal',
  customer: 'customer@test.com',
  group: 'Support',
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-16T14:45:00Z',
  owner_id: undefined,
  group_id: 1,
  ...overrides,
})

describe('TicketDetail', () => {
  describe('基本信息渲染', () => {
    it('应该显示工单编号翻译 key', () => {
      const ticket = createMockTicket({ number: '12345' })
      render(<TicketDetail ticket={ticket} />)

      // mock 的 useTranslations 返回 key 本身
      expect(screen.getByText('ticketNumber')).toBeInTheDocument()
    })

    it('应该显示工单标题', () => {
      const ticket = createMockTicket({ title: 'My Important Issue' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getByText('My Important Issue')).toBeInTheDocument()
    })

    it('应该显示工单状态', () => {
      const ticket = createMockTicket({ state: 'pending reminder' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getByText('pending reminder')).toBeInTheDocument()
    })

    it('应该显示工单优先级', () => {
      const ticket = createMockTicket({ priority: '3 high' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getByText('3 high')).toBeInTheDocument()
    })
  })

  describe('客户信息', () => {
    it('应该显示客户邮箱', () => {
      const ticket = createMockTicket({ customer: 'john.doe@example.com' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    })

    it('应该显示工单分组', () => {
      const ticket = createMockTicket({ group: 'Technical Support' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getByText('Technical Support')).toBeInTheDocument()
    })
  })

  describe('时间戳显示', () => {
    it('应该显示创建时间', () => {
      const ticket = createMockTicket({ created_at: '2024-06-15T08:00:00Z' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getAllByText(/\d{2}-\d{2} \d{2}:\d{2}/)).toHaveLength(2)
    })

    it('应该显示更新时间', () => {
      const ticket = createMockTicket({ updated_at: '2024-07-20T16:30:00Z' })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.getAllByText(/\d{2}-\d{2} \d{2}:\d{2}/)).toHaveLength(2)
    })
  })

  describe('负责人信息', () => {
    it('有负责人时应该显示负责人区域', () => {
      const ticket = createMockTicket({ owner_id: 42 })
      render(<TicketDetail ticket={ticket} />)

      // mock 的 useTranslations 返回 key 本身
      expect(screen.getByText(/assignedTo/i)).toBeInTheDocument()
      expect(screen.getByText('Staff #42')).toBeInTheDocument()
    })

    it('没有负责人时不应该显示负责人区域', () => {
      const ticket = createMockTicket({ owner_id: undefined })
      render(<TicketDetail ticket={ticket} />)

      expect(screen.queryByText(/assignedTo/i)).not.toBeInTheDocument()
    })
  })

  describe('状态颜色映射', () => {
    it('open 状态应该有蓝色背景', () => {
      const ticket = createMockTicket({ state: 'open' })
      render(<TicketDetail ticket={ticket} />)

      const badge = screen.getByText('open')
      expect(badge).toHaveClass('bg-[#3B82F6]')
    })

    it('closed 状态应该有灰色背景', () => {
      const ticket = createMockTicket({ state: 'closed' })
      render(<TicketDetail ticket={ticket} />)

      const badge = screen.getByText('closed')
      expect(badge).toHaveClass('bg-[#9CA3AF]')
    })

    it('pending reminder 状态应该有黄色背景', () => {
      const ticket = createMockTicket({ state: 'pending reminder' })
      render(<TicketDetail ticket={ticket} />)

      const badge = screen.getByText('pending reminder')
      expect(badge).toHaveClass('bg-[#FBBF24]')
    })
  })

  describe('优先级颜色映射', () => {
    it('3 high 优先级应该有红色背景', () => {
      const ticket = createMockTicket({ priority: '3 high' })
      render(<TicketDetail ticket={ticket} />)

      const badge = screen.getByText('3 high')
      expect(badge).toHaveClass('bg-[#EF4444]')
    })

    it('1 low 优先级应该有浅蓝色背景', () => {
      const ticket = createMockTicket({ priority: '1 low' })
      render(<TicketDetail ticket={ticket} />)

      const badge = screen.getByText('1 low')
      expect(badge).toHaveClass('bg-[#A5B4FC]')
    })
  })
})

