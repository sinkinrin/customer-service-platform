"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Ticket, Activity, Settings, AlertCircle, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageTransition } from '@/components/ui/page-transition'
import { TicketTrendChart } from '@/components/admin/charts/ticket-trend-chart'
import { RegionDistributionChart } from '@/components/admin/charts/region-distribution-chart'
import { isValidRegion, type RegionValue } from '@/lib/constants/regions'

interface TicketStats {
  total: number
  open: number
  pending: number
  closed: number
}

interface RegionStats {
  region: string
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

interface RatingStats {
  total: number
  positive: number
  negative: number
  satisfactionRate: number
  recentNegative: Array<{
    ticketId: number
    reason: string
    createdAt: string
  }>
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

const formatRelativeTime = (
  dateString: string,
  tTime: (key: string) => string
) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return tTime('justNow')
  if (diffMins < 60) return `${diffMins} ${tTime('minutes')} ${tTime('ago')}`
  if (diffHours < 24) return `${diffHours} ${tTime('hours')} ${tTime('ago')}`
  if (diffDays < 7) return `${diffDays} ${tTime('days')} ${tTime('ago')}`
  return date.toLocaleDateString()
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const t = useTranslations('admin.dashboard')
  const tCommon = useTranslations('common')
  const tRating = useTranslations('tickets.rating')
  const tRegions = useTranslations('common.regions')
  const tTime = useTranslations('common.time')
  const adminName = user?.full_name || user?.email?.split('@')[0] || tCommon('layout.administrator')
  const [ticketStats, setTicketStats] = useState<TicketStats>({ total: 0, open: 0, pending: 0, closed: 0 })
  const [allTimeStats, setAllTimeStats] = useState<TicketStats>({ total: 0, open: 0, pending: 0, closed: 0 })
  const [statsMode, setStatsMode] = useState<'today' | 'all'>('today')
  const [regionStats, setRegionStats] = useState<RegionStats[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [ratingStats, setRatingStats] = useState<RatingStats>({ total: 0, positive: 0, negative: 0, satisfactionRate: 0, recentNegative: [] })
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Use unified dashboard API for better performance
      const [dashboardRes, ratingsRes] = await Promise.all([
        fetch('/api/admin/stats/dashboard'),
        fetch('/api/admin/stats/ratings'),
      ])

      if (dashboardRes.ok) {
        const data = await dashboardRes.json()
        if (data.success && data.data) {
          setTicketStats(data.data.ticketStats.today)
          setAllTimeStats(data.data.ticketStats.allTime)
          setRegionStats(data.data.regionStats)
          setRecentActivities(data.data.recentActivities)
          setTotalUsers(data.data.totalUsers)
        }
      }

      if (ratingsRes.ok) {
        const data = await ratingsRes.json()
        if (data.success && data.data) {
          setRatingStats(data.data)
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('welcome', { name: adminName })}</h1>
        <p className="text-gray-600 mt-2">{t('overview')}</p>
      </div>

      {/* Statistics Cards with Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('statsOverview')}</h2>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            variant={statsMode === 'today' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatsMode('today')}
            className="h-8"
          >
            {t('statsMode.today')}
          </Button>
          <Button
            variant={statsMode === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatsMode('all')}
            className="h-8"
          >
            {t('statsMode.allTime')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          [1, 2, 3, 4].map((item) => (
            <Card key={`stat-skeleton-${item}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="animate-fade-in motion-reduce:animate-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.totalUsers')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.registeredUsers')}</p>
              </CardContent>
            </Card>

            <Card className="animate-fade-in motion-reduce:animate-none" style={{ animationDelay: '50ms' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.totalTickets')}</CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsMode === 'today' ? ticketStats.total : allTimeStats.total}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {statsMode === 'today' ? t('statsSubtitles.createdToday') : t('statsSubtitles.allTickets')}
                </p>
              </CardContent>
            </Card>

            <Card className="animate-fade-in motion-reduce:animate-none" style={{ animationDelay: '90ms' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.openTickets')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {statsMode === 'today' ? ticketStats.open : allTimeStats.open}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {statsMode === 'today' ? t('statsSubtitles.newToday') : t('statsSubtitles.currentlyOpen')}
                </p>
              </CardContent>
            </Card>

            <Card className="animate-fade-in motion-reduce:animate-none" style={{ animationDelay: '130ms' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.closedTickets')}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statsMode === 'today' ? ticketStats.closed : allTimeStats.closed}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {statsMode === 'today' ? t('statsSubtitles.resolvedToday') : t('statsSubtitles.totalResolved')}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketTrendChart />
        <RegionDistributionChart data={regionStats} loading={loading} />
      </div>

      {/* Regional Details (text version) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('regionalDistribution.title')}</CardTitle>
          <CardDescription>{t('regionalDistribution.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={`region-skeleton-${item}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-6 w-12 ml-auto" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : regionStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('regionalDistribution.noData')}</p>
          ) : (
            <div className="space-y-3">
              {regionStats.map((region) => (
                <div key={region.region} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">
                      {region.region === 'unassigned'
                        ? tRegions('unassigned')
                        : isValidRegion(region.region)
                          ? tRegions(region.region as RegionValue)
                          : region.region}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {region.open} {t('regionalDistribution.open')} / {region.closed} {t('regionalDistribution.closed')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{region.total}</p>
                    <p className="text-xs text-muted-foreground">{t('regionalDistribution.total')}</p>
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
          <CardTitle>{t('quickActions.title')}</CardTitle>
          <CardDescription>{t('quickActions.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/users/create">
            <Button className="w-full">
              <Users className="mr-2 h-4 w-4" />
              {t('quickActions.createUser')}
            </Button>
          </Link>
          <Link href="/admin/tickets">
            <Button className="w-full">
              <Ticket className="mr-2 h-4 w-4" />
              {t('quickActions.viewAllTickets')}
            </Button>
          </Link>
          <Link href="/admin/faq">
            <Button variant="outline" className="w-full">
              <Activity className="mr-2 h-4 w-4" />
              {t('quickActions.manageFAQ')}
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="outline" className="w-full">
              <Settings className="mr-2 h-4 w-4" />
              {t('quickActions.systemSettings')}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Ticket Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentActivity.title')}</CardTitle>
          <CardDescription>{t('recentActivity.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={`activity-skeleton-${item}`} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('recentActivity.noActivity')}</p>
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
                        <p className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp, tTime)}</p>
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
            <CardTitle>{t('systemHealth.title')}</CardTitle>
            <CardDescription>{t('systemHealth.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.apiStatus')}</span>
              <Badge variant="default" className="bg-green-600">{tCommon('status.operational')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.database')}</span>
              <Badge variant="default" className="bg-green-600">{tCommon('status.healthy')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.zammadIntegration')}</span>
              <Badge variant="default" className="bg-green-600">{tCommon('status.connected')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.fastgpt')}</span>
              <Badge variant="outline" className="text-xs">{tCommon('status.notConfigured')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-600" />
              {t('platformMetrics.title')}
            </CardTitle>
            <CardDescription>{t('platformMetrics.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('platformMetrics.customerSatisfaction')}</span>
              <span className="text-sm font-medium text-green-600">{ratingStats.satisfactionRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> {tRating('positive')}
              </span>
              <span className="text-sm font-medium text-green-600">{ratingStats.positive}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" /> {tRating('negative')}
              </span>
              <span className="text-sm font-medium text-red-600">{ratingStats.negative}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('ratings.total')}</span>
              <span className="text-sm font-medium">{ratingStats.total}</span>
            </div>
            {ratingStats.recentNegative.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">{t('ratings.recentNegative')}</p>
                {ratingStats.recentNegative.slice(0, 2).map((item, idx) => (
                  <Link key={idx} href={`/admin/tickets/${item.ticketId}`} className="block">
                    <p className="text-xs text-red-600 hover:underline truncate">
                      #{item.ticketId}: {item.reason}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}

