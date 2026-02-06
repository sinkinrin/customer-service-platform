'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, RefreshCw } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { useTicketsSearch } from '@/lib/hooks/use-tickets-swr'
import { toast } from 'sonner'

type TicketTab = 'all' | 'open' | 'pending' | 'closed'

export default function TicketsPage() {
  const t = useTranslations('staff.tickets')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const PAGE_SIZE = 50

  // Read initial tab from URL, localStorage, or default to 'all'
  const tabFromUrl = searchParams.get('tab') as TicketTab | null
  const validTabs = ['all', 'open', 'pending', 'closed']

  // Get initial tab: prioritize URL > localStorage > default 'all'
  const getInitialTab = () => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      return tabFromUrl
    }
    // Try to restore from localStorage if no URL param
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('staff-tickets-tab') as TicketTab | null
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab
      }
    }
    return 'all'
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('') // Actual query sent to API
  const [activeTab, setActiveTab] = useState<TicketTab>(getInitialTab())
  const [currentPage, setCurrentPage] = useState(1)
  const statusFilter = activeTab === 'all' ? undefined : activeTab

  // Use SWR for caching - fetches with server-side filters for stable pagination
  const { tickets, total, isLoading, revalidate } = useTicketsSearch(submittedQuery, PAGE_SIZE, currentPage, true, {
    queryMode: 'keyword',
    status: statusFilter,
    sort: 'created_at',
    order: 'desc',
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleSearch = () => {
    const query = searchQuery.trim()
    setCurrentPage(1)
    setSubmittedQuery(query)
  }

  const handleRefresh = () => {
    revalidate()
    toast.info(t('status.refreshed'))
  }

  const handleTabChange = (value: string) => {
    const newTab = value as typeof activeTab
    setActiveTab(newTab)
    setCurrentPage(1)

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

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  const startTicketIndex = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endTicketIndex = Math.min(currentPage * PAGE_SIZE, total)

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
          </TabsTrigger>
          <TabsTrigger value="open" className="min-w-[120px]">
            {t('tabs.open')}
          </TabsTrigger>
          <TabsTrigger value="pending" className="min-w-[120px]">
            {t('tabs.pending')}
          </TabsTrigger>
          <TabsTrigger value="closed" className="min-w-[120px]">
            {t('tabs.closed')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <TicketList tickets={tickets} isLoading={isLoading} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {startTicketIndex}-{endTicketIndex} / {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreviousPage}
                disabled={isLoading || currentPage <= 1}
              >
                {tCommon('previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={isLoading || total === 0 || currentPage >= totalPages}
              >
                {tCommon('next')}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

