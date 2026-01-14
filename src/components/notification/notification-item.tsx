"use client"

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { getNotificationLink } from '@/lib/notification'
import type { NotificationItem as NotificationItemType } from '@/lib/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: NotificationItemType
  onRead: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const router = useRouter()
  const { userRole } = useAuth()

  const link = getNotificationLink(notification.data as any, userRole || 'customer')

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-accent/50',
        !notification.read && 'bg-accent/20'
      )}
      onClick={async () => {
        if (!notification.read) {
          await onRead(notification.id)
        }
        if (link) {
          router.push(link)
        }
      }}
      onKeyDown={async (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (!notification.read) {
          await onRead(notification.id)
        }
        if (link) {
          router.push(link)
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium truncate', !notification.read && 'font-semibold')}>
            {notification.title}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={async (e) => {
              e.stopPropagation()
              await onDelete(notification.id)
            }}
            aria-label="Delete notification"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
      </div>
    </div>
  )
}

