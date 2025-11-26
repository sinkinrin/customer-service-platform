/**
 * Conversation Summary Component
 * 
 * Displays conversation statistics cards
 */

'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Clock, CheckCircle2 } from 'lucide-react'

interface ConversationStats {
  total: number
  waiting: number
  active: number
  closed: number
}

interface ConversationSummaryProps {
  stats: ConversationStats
  isLoading?: boolean
}

export function ConversationSummary({ stats, isLoading = false }: ConversationSummaryProps) {
  const router = useRouter()
  
  const cards = [
    {
      title: 'Total Conversations',
      value: stats.total,
      icon: MessageSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      onClick: () => router.push('/conversations'),
    },
    {
      title: 'Waiting',
      value: stats.waiting,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      onClick: () => router.push('/conversations?status=waiting'),
    },
    {
      title: 'Active',
      value: stats.active,
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      onClick: () => router.push('/conversations?status=active'),
    },
    {
      title: 'Closed',
      value: stats.closed,
      icon: CheckCircle2,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      onClick: () => router.push('/conversations?status=closed'),
    },
  ]
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse motion-reduce:animate-none rounded" />
              <div className="h-8 w-8 bg-muted animate-pulse motion-reduce:animate-none rounded-lg" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse motion-reduce:animate-none rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={card.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

