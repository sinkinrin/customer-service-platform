"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/hooks/use-auth'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { getNotificationLink } from '@/lib/notification'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const t = useTranslations('notificationCenter')
  const { userRole } = useAuth()
  const { notifications } = useNotifications({ pollIntervalMs: 15000 })

  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const notification of notifications) {
      if (seenIdsRef.current.has(notification.id)) continue
      seenIdsRef.current.add(notification.id)

      if (notification.read) continue

      const link = getNotificationLink(notification.data as any, userRole || 'customer')

      toast.info(notification.title, {
        description: notification.body,
        action: link
          ? {
              label: t('view'),
              onClick: () => router.push(link),
            }
          : undefined,
        duration: 5000,
      })
    }
  }, [notifications, router, t, userRole])

  return <>{children}</>
}

