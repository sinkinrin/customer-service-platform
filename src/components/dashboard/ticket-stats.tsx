'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react'

interface TicketStatsProps {
  stats: {
    open: number
    pending: number
    resolved: number
    closed: number
  }
  isLoading?: boolean
}

export function TicketStats({ stats, isLoading }: TicketStatsProps) {
  const router = useRouter()

  const cards = [
    {
      title: 'Open Tickets',
      value: stats.open,
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      onClick: () => router.push('/staff/tickets?status=open'),
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      onClick: () => router.push('/staff/tickets?status=pending'),
    },
    {
      title: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900',
      onClick: () => router.push('/staff/tickets?status=resolved'),
    },
    {
      title: 'Closed',
      value: stats.closed,
      icon: XCircle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-900',
      onClick: () => router.push('/staff/tickets?status=closed'),
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={card.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-full ${card.bgColor} flex items-center justify-center`}>
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

