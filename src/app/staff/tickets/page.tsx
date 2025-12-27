'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, RefreshCw } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { useTicketsSearch, invalidateTicketsCache } from '@/lib/hooks/use-tickets-swr'
import { toast } from 'sonner'

export default function TicketsPage() {
  const t = useTranslations('staff.tickets')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Read initial tab from URL, localStorage, or default to 'all'
  const tabFromUrl = searchParams.get('tab') as 'all' | 'open' | 'pending' | 'closed' | null
  const validTabs = ['all', 'open', 'pending', 'closed']

  // Get initial tab: prioritize URL > localStorage > default 'all'
  const getInitialTab = () => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      return tabFromUrl
    }
    // Try to restore from localStorage if no URL param
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('staff-tickets-tab') as 'all' | 'open' | 'pending' | 'closed' | null
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab
      }
    }
    return 'all'
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('state:*') // Actual query sent to API
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'closed'>(getInitialTab())

  // Use SWR for caching - only fetches when submittedQuery changes
  // Reduced from 50 to 20 for optimal initial load performance
  const { tickets, isLoading, isValidating, revalidate } = useTicketsSearch(submittedQuery, 20)

  const handleSearch = () => {
    const query = searchQuery.trim() || 'state:*'
    setSubmittedQuery(query)
  }

  const handleRefresh = () => {
    revalidate()
    toast.info(t('status.refreshed'))
  }

  const handleTabChange = (value: string) => {
    const newTab = value as typeof activeTab
    setActiveTab(newTab)

    // Save to localStorage for persistence across navigations
    if (typeof window !== 'undefined') {
      localStorage.setItem('staff-tickets-tab', newTab)
    }

    // Update URL with new tab value for state persistence
    const params = new URLSearchParams(searchParams.toString())
    if (newTab === 'all') {
      params.delete('tab')
    } else {
      params.set('tab', newTab)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (activeTab === 'all') return true

    const stateLower = ticket.state.toLowerCase()
    if (activeTab === 'open') {
      return stateLower.includes('new') || stateLower.includes('open')
    }
    if (activeTab === 'pending') {
      return stateLower.includes('pending')
    }
    if (activeTab === 'closed') {
      return stateLower.includes('closed')
    }
    return true
  })

  // Calculate counts for all tabs in a single pass (performance optimization)
  const tabCounts = tickets.reduce(
    (acc, ticket) => {
      const stateLower = ticket.state.toLowerCase()
      if (stateLower.includes('new') || stateLower.includes('open')) {
        acc.open++
      } else if (stateLower.includes('pending')) {
        acc.pending++
      } else if (stateLower.includes('closed')) {
        acc.closed++
      }
      return acc
    },
    { all: tickets.length, open: 0, pending: 0, closed: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('pageDescription')}
          </p>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('actions.refresh')}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {t('search.button')}
        </Button>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          {t('filters.button')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="min-w-[120px]">
            {t('tabs.all')}
            <span className="ml-2 text-xs">
              ({isLoading ? '...' : tabCounts.all})
            </span>
          </TabsTrigger>
          <TabsTrigger value="open" className="min-w-[120px]">
            {t('tabs.open')}
            <span className="ml-2 text-xs">
              ({isLoading ? '...' : tabCounts.open})
            </span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="min-w-[120px]">
            {t('tabs.pending')}
            <span className="ml-2 text-xs">
              ({isLoading ? '...' : tabCounts.pending})
            </span>
          </TabsTrigger>
          <TabsTrigger value="closed" className="min-w-[120px]">
            {t('tabs.closed')}
            <span className="ml-2 text-xs">
              ({isLoading ? '...' : tabCounts.closed})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <TicketList tickets={filteredTickets} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

