'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, Download, Zap, Loader2, RefreshCw } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { TicketAssignDialog } from '@/components/admin/ticket-assign-dialog'
import { useTicketsSearch, useTicketsList } from '@/lib/hooks/use-tickets-swr'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REGIONS, getGroupIdByRegion } from '@/lib/constants/regions'
import { toast } from 'sonner'

interface SelectedTicket {
  id: number
  number: string
  title: string
  owner_id?: number | null
}

type TicketTab = 'all' | 'open' | 'pending' | 'closed'

function getStatusQueryForTab(tab: TicketTab): string | null {
  if (tab === 'open') return '(state_id:1 OR state_id:2)'
  if (tab === 'pending') return '(state_id:3 OR state_id:7)'
  if (tab === 'closed') return 'state_id:4'
  return null
}

function getPriorityId(priority: string): number | undefined {
  if (priority === 'low') return 1
  if (priority === 'normal') return 2
  if (priority === 'high') return 3
  return undefined
}

export default function AdminTicketsPage() {
  const t = useTranslations('admin.tickets')
  const tCommon = useTranslations('common')
  const tToast = useTranslations('toast.admin.tickets')
  const tRegions = useTranslations('common.regions')
  const PAGE_SIZE = 50
  const [searchQuery, setSearchQuery] = useState('')

  // Get initial tab from localStorage or default to 'all'
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('admin-tickets-tab') as TicketTab | null
      if (savedTab && ['all', 'open', 'pending', 'closed'].includes(savedTab)) {
        return savedTab
      }
    }
    return 'all'
  }

  const [activeTab, setActiveTab] = useState<TicketTab>(getInitialTab())
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [submittedQuery, setSubmittedQuery] = useState('') // Empty = fetch all
  const [currentPage, setCurrentPage] = useState(1)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SelectedTicket | null>(null)
  const [autoAssigning, setAutoAssigning] = useState(false)

  const statusQuery = getStatusQueryForTab(activeTab)
  const statusFilter = activeTab === 'all' ? undefined : activeTab
  const priorityFilter = getPriorityId(selectedPriority)
  const groupIdFilter = selectedRegion === 'all' ? undefined : getGroupIdByRegion(selectedRegion as any)

  const scopedSearchQuery = (() => {
    const baseQuery = submittedQuery.trim() ? `(${submittedQuery.trim()})` : 'state:*'
    const parts = [baseQuery]
    if (statusQuery) {
      parts.push(statusQuery)
    }
    if (priorityFilter) {
      parts.push(`priority_id:${priorityFilter}`)
    }
    if (groupIdFilter) {
      parts.push(`group_id:${groupIdFilter}`)
    }
    return parts.join(' AND ')
  })()

  // Use SWR for caching - search when query exists, otherwise fetch all
  const searchResult = useTicketsSearch(scopedSearchQuery, PAGE_SIZE, currentPage, !!submittedQuery)
  const listResult = useTicketsList(PAGE_SIZE, currentPage, statusFilter, priorityFilter, groupIdFilter, !submittedQuery)

  // Use search results if query exists, otherwise use list results
  const tickets = submittedQuery ? searchResult.tickets : listResult.tickets
  const totalTickets = submittedQuery ? searchResult.total : listResult.total
  const isLoading = submittedQuery ? searchResult.isLoading : listResult.isLoading
  const revalidate = submittedQuery ? searchResult.revalidate : listResult.revalidate
  const totalPages = Math.max(1, Math.ceil(totalTickets / PAGE_SIZE))

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
      localStorage.setItem('admin-tickets-tab', newTab)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const exportTickets = async () => {
    try {
      toast.info(t('status.exporting'))
      const response = await fetch('/api/tickets/export')
      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'tickets-export.csv'

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(t('status.exported'))
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t('status.exportFailed'))
    }
  }

  const handleAssign = (ticket: SelectedTicket) => {
    setSelectedTicket(ticket)
    setAssignDialogOpen(true)
  }

  const handleAssignSuccess = () => {
    revalidate()
  }

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  const startTicketIndex = totalTickets === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endTicketIndex = Math.min(currentPage * PAGE_SIZE, totalTickets)

  const handleAutoAssign = async () => {
    setAutoAssigning(true)
    try {
      const res = await fetch('/api/tickets/auto-assign', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(tToast('autoAssignSuccess', { success: data.data.success, failed: data.data.failed }))
        revalidate()
      } else {
        toast.error(data.error?.message || tToast('autoAssignFailed'))
      }
    } catch (error) {
      toast.error(tToast('autoAssignFailed'))
      console.error('Auto-assign error:', error)
    } finally {
      setAutoAssigning(false)
    }
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

        {/* Refresh Button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('actions.refresh')}
          </Button>
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
          <Select
            value={selectedRegion}
            onValueChange={(value) => {
              setSelectedRegion(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('filters.allRegions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allRegions')}</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {tRegions(region.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedPriority}
            onValueChange={(value) => {
              setSelectedPriority(value)
              setCurrentPage(1)
            }}
          >
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
          <Button
            variant="default"
            onClick={handleAutoAssign}
            disabled={autoAssigning}
          >
            {autoAssigning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {t('actions.autoAssign')}
          </Button>
        </div>
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
          <TicketList tickets={tickets} isLoading={isLoading} onAssign={handleAssign} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {startTicketIndex}-{endTicketIndex} / {totalTickets}
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
                disabled={isLoading || totalTickets === 0 || currentPage >= totalPages}
              >
                {tCommon('next')}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TicketAssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        ticket={selectedTicket}
        onSuccess={handleAssignSuccess}
      />
    </div>
  )
}

