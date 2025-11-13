/**
 * System Message Component
 *
 * Displays system messages (transfer notifications, etc.)
 */

'use client'

import { Info, CheckCircle2, AlertCircle } from 'lucide-react'

interface SystemMessageProps {
  content: string
  type?: 'info' | 'success' | 'warning'
  timestamp: string
}

export function SystemMessage({
  content,
  type = 'info',
  timestamp,
}: SystemMessageProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />
      case 'warning':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100'
      default:
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex justify-center my-4">
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getBackgroundColor()}`}
      >
        {getIcon()}
        <p className="text-sm font-medium whitespace-pre-wrap text-center">
          {content}
        </p>
        <span className="text-xs opacity-70">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  )
}
