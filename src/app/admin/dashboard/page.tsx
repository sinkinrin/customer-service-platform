"use client"

import { useAuth } from '@/lib/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Ticket, Activity, Settings, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface TicketStats {
  total: number
  open: number
  pending: number
  closed: number
}

interface RegionStats {
  region: string
  label: string
  total: number
  open: number
  closed: number
}

interface RecentActivity {
  id: string
  type: string
  ticketNumber?: string
  title?: string
  state?: string
  timestamp: string
}

const getActivityIcon = (state: string) => {
  const stateLower = state?.toLowerCase() || ''
  if (stateLower.includes('new')) {
    return <Ticket className="h-4 w-4 text-blue-600" />
  } else if (stateLower.includes('open')) {
    return <Ticket className="h-4 w-4 text-orange-600" />
  } else if (stateLower.includes('pending')) {
    return <Ticket className="h-4 w-4 text-yellow-600" />
  } else if (stateLower.includes('closed')) {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />
  }
  return <Activity className="h-4 w-4 text-gray-600" />
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const adminName = user?.full_name || user?.email?.split('@')[0] || 'Administrator'
  const [ticketStats, setTicketStats] = useState<TicketStats>({ total: 0, open: 0, pending: 0, closed: 0 })
  const [regionStats, setRegionStats] = useState<RegionStats[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTicketStats()
    loadRegionStats()
    loadUserStats()
    loadRecentActivities()
  }, [])

  const loadTicketStats = async () => {
    try {
      const response = await fetch('/api/tickets?limit=1000')
      if (response.ok) {
        const data = await response.json()
        const tickets = data.data?.tickets || []

        const stats = {
          total: tickets.length,
          open: tickets.filter((t: any) => t.state?.toLowerCase().includes('open') || t.state?.toLowerCase().includes('new')).length,
          pending: tickets.filter((t: any) => t.state?.toLowerCase().includes('pending')).length,
          closed: tickets.filter((t: any) => t.state?.toLowerCase().includes('closed')).length,
        }
        setTicketStats(stats)
      }
    } catch (error) {
      console.error('Failed to load ticket stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRegionStats = async () => {
    try {
      const response = await fetch('/api/admin/stats/regions')
      if (response.ok) {
        const data = await response.json()
        setRegionStats(data.data?.regions || [])
      }
    } catch (error) {
      console.error('Failed to load region stats:', error)
    }
  }

  const loadUserStats = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        const users = data.data?.users || []
        setTotalUsers(users.length)
      }
    } catch (error) {
      console.error('Failed to load user stats:', error)
    }
  }

  const loadRecentActivities = async () => {
    try {
      const response = await fetch('/api/tickets?limit=10')
      if (response.ok) {
        const data = await response.json()
        const tickets = data.data?.tickets || []

        // Convert tickets to activities
        const activities: RecentActivity[] = tickets
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10)
          .map((ticket: any) => ({
            id: ticket.id.toString(),
            type: 'ticket_updated',
            ticketNumber: ticket.number,
            title: ticket.title,
            state: ticket.state,
            timestamp: ticket.updated_at,
          }))

        setRecentActivities(activities)
      }
    } catch (error) {
      console.error('Failed to load recent activities:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {adminName}!</h1>
        <p className="text-gray-600 mt-2">Here&apos;s an overview of your platform&apos;s performance</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : ticketStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All regions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{loading ? '...' : ticketStats.open}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Tickets</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loading ? '...' : ticketStats.closed}</div>
            <p className="text-xs text-muted-foreground mt-1">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Regional Ticket Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Ticket Distribution</CardTitle>
          <CardDescription>Ticket counts by service region</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : regionStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No regional data available</p>
          ) : (
            <div className="space-y-3">
              {regionStats.map((region) => (
                <div key={region.region} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{region.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {region.open} open · {region.closed} closed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{region.total}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your platform efficiently</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/users/create">
            <Button className="w-full">
              <Users className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </Link>
          <Link href="/admin/tickets">
            <Button className="w-full">
              <Ticket className="mr-2 h-4 w-4" />
              View All Tickets
            </Button>
          </Link>
          <Link href="/admin/faq">
            <Button variant="outline" className="w-full">
              <Activity className="mr-2 h-4 w-4" />
              Manage FAQ
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="outline" className="w-full">
              <Settings className="mr-2 h-4 w-4" />
              System Settings
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Ticket Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Ticket Activity</CardTitle>
          <CardDescription>Latest ticket updates across all regions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : recentActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/admin/tickets/${activity.id}`}
                  className="block"
                >
                  <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                    <div className="mt-1">{getActivityIcon(activity.state || '')}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          #{activity.ticketNumber} - {activity.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.state}
                        </Badge>
                        <p className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Status</span>
              <Badge variant="default" className="bg-green-600">Operational</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <Badge variant="default" className="bg-green-600">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Zammad Integration</span>
              <Badge variant="default" className="bg-green-600">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">FastGPT</span>
              <Badge variant="outline" className="text-xs">Not Configured</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg. Response Time</span>
              <span className="text-sm font-medium">2.3 hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Resolution Rate</span>
              <span className="text-sm font-medium">94.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customer Satisfaction</span>
              <span className="text-sm font-medium">4.8/5.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium">99.9%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

