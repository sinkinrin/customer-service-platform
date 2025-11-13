/**
 * Transfer History Message Component
 *
 * Displays AI conversation history in a collapsible format (for staff view)
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bot, User, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AIHistoryItem {
  role: 'customer' | 'ai'
  content: string
  timestamp: string
}

interface TransferHistoryMessageProps {
  aiHistory: AIHistoryItem[]
  transferredAt: string
}

export function TransferHistoryMessage({
  aiHistory,
  transferredAt,
}: TransferHistoryMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="my-4">
      <Card className="border-2 border-dashed border-muted-foreground/30 bg-muted/30">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">AI 对话历史</h4>
                  <Badge variant="outline" className="text-xs">
                    {aiHistory.length} 条消息
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  转接时间：{formatDateTime(transferredAt)}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  展开
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Collapsible History Content */}
        {isExpanded && (
          <div className="border-t bg-background/50 p-4 space-y-3 max-h-96 overflow-y-auto">
            {aiHistory.map((item, index) => (
              <div
                key={index}
                className={`flex gap-2 ${
                  item.role === 'customer' ? 'justify-end' : 'justify-start'
                }`}
              >
                {item.role === 'ai' && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    item.role === 'customer'
                      ? 'bg-blue-500 text-white'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {item.content}
                  </p>
                  <p className={`text-xs mt-1 ${
                    item.role === 'customer'
                      ? 'text-blue-100'
                      : 'text-muted-foreground'
                  }`}>
                    {formatTime(item.timestamp)}
                  </p>
                </div>

                {item.role === 'customer' && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
