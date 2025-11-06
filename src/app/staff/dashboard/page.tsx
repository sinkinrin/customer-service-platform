'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TicketStats } from '@/components/dashboard/ticket-stats'
import { RecentTickets } from '@/components/dashboard/recent-tickets'
import { Plus, Search, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTicket } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

export default function StaffDashboardPage() {
  const router = useRouter()
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
      const result = await searchTickets('state:*', 50)
      if (result) {
        const tickets = result.tickets
        const openCount = tickets.filter(t => t.state.toLowerCase().includes('new') || t.state.toLowerCase().includes('open')).length
        const pendingCount = tickets.filter(t => t.state.toLowerCase().includes('pending')).length
        const resolvedCount = tickets.filter(t => t.state.toLowerCase().includes('resolved')).length
        const closedCount = tickets.filter(t => t.state.toLowerCase().includes('closed')).length
        setStats({ open: openCount, pending: pendingCount, resolved: resolvedCount, closed: closedCount })
        setRecentTickets(tickets.slice(0, 10))
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back! Here&apos;s an overview of your tickets.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/staff/tickets')}>
            <Search className="h-4 w-4 mr-2" />
            Search Tickets
          </Button>
          <Button variant="outline" onClick={() => router.push('/staff/knowledge')}>
            <BookOpen className="h-4 w-4 mr-2" />
            Knowledge Base
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
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/tickets')}>
                <Search className="h-4 w-4 mr-2" />
                View All Tickets
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/tickets?status=open')}>
                <Plus className="h-4 w-4 mr-2" />
                Open Tickets
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => router.push('/staff/knowledge')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Knowledge Base
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Check out our knowledge base for common questions and solutions.</p>
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/staff/knowledge')}>
                Browse Articles →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

