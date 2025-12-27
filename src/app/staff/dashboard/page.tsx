'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TicketStats } from '@/components/dashboard/ticket-stats'
import { RecentTickets } from '@/components/dashboard/recent-tickets'
import { PageTransition } from '@/components/ui/page-transition'
import { Plus, Search, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTicket } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useTranslations } from 'next-intl'

export default function StaffDashboardPage() {
  const router = useRouter()
  const t = useTranslations('staff.dashboard')
  const tActions = useTranslations('staff.dashboard.actions')
  const tQuick = useTranslations('staff.dashboard.quickActions')
  const tHelp = useTranslations('staff.dashboard.helpCard')
  const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0, closed: 0 })
  const [recentTickets, setRecentTickets] = useState<ZammadTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { searchTickets } = useTicket()

  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Reduced from 50 to 20 for optimal performance
      const result = await searchTickets('state:*', 20)
      if (result) {
        const tickets = result.tickets
        // Single-pass count calculation (performance optimization)
        const counts = tickets.reduce(
          (acc, t) => {
            const stateLower = t.state.toLowerCase()
            if (stateLower.includes('new') || stateLower.includes('open')) {
              acc.open++
            } else if (stateLower.includes('pending')) {
              acc.pending++
            } else if (stateLower.includes('resolved')) {
              acc.resolved++
            } else if (stateLower.includes('closed')) {
              acc.closed++
            }
            return acc
          },
          { open: 0, pending: 0, resolved: 0, closed: 0 }
        )
        setStats(counts)
        setRecentTickets(tickets.slice(0, 10))
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('welcomeMessage')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/staff/tickets')}>
            <Search className="h-4 w-4 mr-2" />
            {tActions('searchTickets')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/staff/knowledge')}>
            <BookOpen className="h-4 w-4 mr-2" />
            {tActions('knowledgeBase')}
          </Button>
        </div>
      </div>

      <TicketStats stats={stats} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentTickets tickets={recentTickets} isLoading={isLoading} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tQuick('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/tickets')}>
                <Search className="h-4 w-4 mr-2" />
                {tActions('viewAllTickets')}
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/tickets?status=open')}>
                <Plus className="h-4 w-4 mr-2" />
                {tActions('openTickets')}
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/knowledge')}>
                <BookOpen className="h-4 w-4 mr-2" />
                {tActions('browseKnowledgeBase')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tHelp('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{tHelp('description')}</p>
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/staff/knowledge')}>
                {tActions('browseArticles')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}

