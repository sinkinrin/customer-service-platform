/**
 * MessageInput 组件测试
 *
 * 测试用户交互行为：
 * - 输入文本
 * - 发送消息（点击按钮和 Enter 键）
 * - 文件选择和移除
 * - 禁用状态
 * - 字符限制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageInput } from '@/components/conversation/message-input'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('MessageInput', () => {
  const mockOnSend = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSend.mockResolvedValue(undefined)
  })

  describe('渲染', () => {
    it('应该渲染输入框和发送按钮', () => {
      render(<MessageInput onSend={mockOnSend} />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      // 发送按钮通过 title 属性识别
      expect(screen.getByTitle('sendMessage')).toBeInTheDocument()
    })

    it('应该显示自定义 placeholder', () => {
      render(<MessageInput onSend={mockOnSend} placeholder="Custom placeholder" />)

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
    })

    it('应该渲染文件上传按钮', () => {
      render(<MessageInput onSend={mockOnSend} />)

      expect(screen.getByTitle('attachFile')).toBeInTheDocument()
    })
  })

  describe('文本输入', () => {
    it('应该允许用户输入文本', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello, world!')

      expect(input).toHaveValue('Hello, world!')
    })

    it('应该限制输入长度不超过 maxLength', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} maxLength={10} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '12345678901234567890') // 20 chars

      // 只保留前 10 个字符
      expect(input).toHaveValue('1234567890')
    })

    it('接近字符限制时应该显示字符计数', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} maxLength={100} />)

      const input = screen.getByRole('textbox')
      // 输入超过 80% 的字符 (81 chars)
      await user.type(input, 'a'.repeat(81))

      expect(screen.getByText('81/100')).toBeInTheDocument()
    })
  })

  describe('发送消息', () => {
    it('点击发送按钮应该调用 onSend', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      const sendButton = screen.getByTitle('sendMessage')
      await user.click(sendButton)

      expect(mockOnSend).toHaveBeenCalledWith('Test message', 'text', undefined)
    })

    it('按 Enter 键应该发送消息', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message{Enter}')

      expect(mockOnSend).toHaveBeenCalledWith('Test message', 'text', undefined)
    })

    it('按 Shift+Enter 不应该发送消息（换行）', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('发送后应该清空输入框', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.click(screen.getByTitle('sendMessage'))

      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('空消息不应该触发发送', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const sendButton = screen.getByTitle('sendMessage')
      await user.click(sendButton)

      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('只有空格的消息不应该触发发送', async () => {
      const user = userEvent.setup()
      render(<MessageInput onSend={mockOnSend} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '   ')
      await user.click(screen.getByTitle('sendMessage'))

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('禁用状态', () => {
    it('disabled=true 时输入框应该被禁用', () => {
      render(<MessageInput onSend={mockOnSend} disabled={true} />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('isSending=true 时应该禁用输入', () => {
      render(<MessageInput onSend={mockOnSend} isSending={true} />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })
})

