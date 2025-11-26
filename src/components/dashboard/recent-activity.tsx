/**
 * Recent Activity Component
 *
 * Displays recent messages and conversation status changes
 */

'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, Clock, CheckCircle2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'

interface Activity {
  id: string
  type: 'message' | 'status_change' | 'assignment'
  conversation_id: string
  content?: string
  status?: 'waiting' | 'active' | 'closed'
  user?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  created_at: string
}

interface RecentActivityProps {
  activities: Activity[]
  isLoading?: boolean
}

export function RecentActivity({ activities, isLoading = false }: RecentActivityProps) {
  const router = useRouter()
  const t = useTranslations('dashboardComponents.recentActivity')

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'message':
        return MessageSquare
      case 'status_change':
        return CheckCircle2
      case 'assignment':
        return User
      default:
        return Clock
    }
  }
  
  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'message':
        return 'text-blue-600 bg-blue-100'
      case 'status_change':
        return 'text-green-600 bg-green-100'
      case 'assignment':
        return 'text-purple-600 bg-purple-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }
  
  const getActivityTitle = (activity: Activity) => {
    switch (activity.type) {
      case 'message':
        return t('activity.newMessage')
      case 'status_change':
        return t('activity.statusChanged', { status: activity.status || 'unknown' })
      case 'assignment':
        return t('activity.assigned')
      default:
        return t('activity.default')
    }
  }
  
  const getStatusVariant = (status?: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'waiting':
        return 'secondary'
      case 'active':
        return 'default'
      case 'closed':
        return 'outline'
      default:
        return 'outline'
    }
  }
  
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 bg-muted animate-pulse motion-reduce:animate-none rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse motion-reduce:animate-none rounded" />
                  <div className="h-3 w-48 bg-muted animate-pulse motion-reduce:animate-none rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse motion-reduce:animate-none rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('noActivity')}</h3>
            <p className="text-muted-foreground">
              {t('noActivityHint')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type)
              const colorClass = getActivityColor(activity.type)
              
              return (
                <div
                  key={activity.id}
                  className="flex gap-4 cursor-pointer hover:bg-accent p-2 rounded-lg transition-colors"
                  onClick={() => router.push(`/conversations/${activity.conversation_id}`)}
                >
                  {/* Icon or Avatar */}
                  {activity.user ? (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={activity.user.avatar_url} alt={activity.user.full_name} />
                      <AvatarFallback>{getInitials(activity.user.full_name)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">
                        {getActivityTitle(activity)}
                      </p>
                      {activity.status && (
                        <Badge variant={getStatusVariant(activity.status)} className="text-xs">
                          {activity.status}
                        </Badge>
                      )}
                    </div>
                    
                    {activity.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                        {activity.content}
                      </p>
                    )}
                    
                    {activity.user && (
                      <p className="text-xs text-muted-foreground">
                        {activity.user.full_name}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

