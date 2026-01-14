"use client"

import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationList } from './notification-list'

export function NotificationCenter() {
  const t = useTranslations('notificationCenter')
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, isLoading } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">{t('title')}</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0}
            onClick={async () => {
              await markAllAsRead()
            }}
          >
            {t('markAllRead')}
          </Button>
        </div>

        <ScrollArea className="h-[420px]">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">{t('loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <NotificationList
              notifications={notifications}
              onRead={markAsRead}
              onDelete={deleteNotification}
            />
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

