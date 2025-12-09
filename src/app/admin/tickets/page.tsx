'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, Download, Wifi, WifiOff, Bell } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { useTicketsSearch, useTicketsList } from '@/lib/hooks/use-tickets-swr'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REGIONS, getGroupIdByRegion } from '@/lib/constants/regions'
import { useSSE } from '@/lib/hooks/use-sse'
import { toast } from 'sonner'

export default function AdminTicketsPage() {
  const t = useTranslations('admin.tickets')
  const tToast = useTranslations('toast.admin.tickets')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'closed'>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [hasNewUpdates, setHasNewUpdates] = useState(false)
  const [submittedQuery, setSubmittedQuery] = useState('') // Empty = fetch all

  // Use SWR for caching - search when query exists, otherwise fetch all
  const searchResult = useTicketsSearch(submittedQuery, 100, !!submittedQuery)
  const listResult = useTicketsList(1000, undefined, !submittedQuery)
  
  // Use search results if query exists, otherwise use list results
  const tickets = submittedQuery ? searchResult.tickets : listResult.tickets
  const isLoading = submittedQuery ? searchResult.isLoading : listResult.isLoading
  const revalidate = submittedQuery ? searchResult.revalidate : listResult.revalidate

  // SSE connection for real-time updates
  const { state: sseState, isConnected } = useSSE({
    url: '/api/sse/tickets',
    enabled: true,
    onMessage: (event) => {
      if (event.type === 'ticket_updated' || event.type === 'ticket_created' || event.type === 'ticket_deleted') {
        // Show notification badge
        setHasNewUpdates(true)

        // Show toast
        const messages = {
          ticket_created: tToast('ticketCreated'),
          ticket_updated: tToast('ticketUpdated'),
          ticket_deleted: tToast('ticketDeleted'),
        }
        toast.info(messages[event.type as keyof typeof messages] || tToast('ticketChanged'))
      }
    },
  })

  const handleSearch = () => {
    const query = searchQuery.trim()
    setSubmittedQuery(query)
    setHasNewUpdates(false) // Clear notification badge after refresh
  }

  const handleRefresh = () => {
    revalidate()
    setHasNewUpdates(false)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as typeof activeTab)
    // Filtering is done client-side via filteredTickets
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Filter tickets by region and priority
  const filteredTickets = tickets.filter((ticket) => {
    // Filter by status tab
    if (activeTab !== 'all') {
      const stateLower = ticket.state?.toLowerCase() || ''
      if (activeTab === 'open') {
        if (!stateLower.includes('new') && !stateLower.includes('open')) return false
      } else if (activeTab === 'pending') {
        if (!stateLower.includes('pending')) return false
      } else if (activeTab === 'closed') {
        if (!stateLower.includes('closed')) return false
      }
    }

    // Filter by region using canonical group_id
    if (selectedRegion !== 'all') {
      const expectedGroupId = getGroupIdByRegion(selectedRegion as any)
      if (ticket.group_id && ticket.group_id !== expectedGroupId) {
        return false
      }
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      const priorityLower = ticket.priority?.toLowerCase() || ''
      if (!priorityLower.includes(selectedPriority.toLowerCase())) return false
    }

    return true
  })

  const exportTickets = () => {
    // TODO: Implement CSV export
    console.log('Exporting tickets...', filteredTickets)
  }

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

        {/* SSE Status Indicator */}
        <div className="flex items-center gap-2">
          {hasNewUpdates && (
            <Badge variant="destructive" className="animate-pulse motion-reduce:animate-none">
              <Bell className="h-3 w-3 mr-1" />
              {t('status.newUpdates')}
            </Badge>
          )}
          {isConnected ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Wifi className="h-4 w-4" />
              <span>{t('status.live')}</span>
            </div>
          ) : sseState === 'connecting' ? (
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <WifiOff className="h-4 w-4 animate-pulse motion-reduce:animate-none" />
              <span>{t('status.connecting')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <WifiOff className="h-4 w-4" />
              <span>{t('status.offline')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            {t('search.button')}
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('filters.allRegions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allRegions')}</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {region.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('filters.allPriorities')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allPriorities')}</SelectItem>
              <SelectItem value="low">{t('filters.priority.low')}</SelectItem>
              <SelectItem value="normal">{t('filters.priority.normal')}</SelectItem>
              <SelectItem value="high">{t('filters.priority.high')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportTickets}>
            <Download className="h-4 w-4 mr-2" />
            {t('actions.export')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            {t('tabs.all')}
            {activeTab === 'all' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open">
            {t('tabs.open')}
            {activeTab === 'open' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t('tabs.pending')}
            {activeTab === 'pending' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">
            {t('tabs.closed')}
            {activeTab === 'closed' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <TicketList tickets={filteredTickets} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

