"use client"

import type { NotificationItem as NotificationItemType } from '@/lib/hooks/use-notifications'
import { NotificationItem } from './notification-item'

export function NotificationList({
  notifications,
  onRead,
  onDelete,
}: {
  notifications: NotificationItemType[]
  onRead: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={onRead}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

