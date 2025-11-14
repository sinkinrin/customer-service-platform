'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Filter, Download, Wifi, WifiOff, Bell } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { useTicket } from '@/lib/hooks/use-ticket'
import { useTicketStore } from '@/lib/stores/ticket-store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REGIONS } from '@/lib/constants/regions'
import { useSSE } from '@/lib/hooks/use-sse'
import { toast } from 'sonner'

export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'closed'>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [hasNewUpdates, setHasNewUpdates] = useState(false)
  const { tickets, setTickets, setFilters } = useTicketStore()
  const { fetchTickets, searchTickets, isLoading } = useTicket()

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
          ticket_created: 'New ticket created',
          ticket_updated: 'Ticket updated',
          ticket_deleted: 'Ticket deleted',
        }
        toast.info(messages[event.type as keyof typeof messages] || 'Ticket changed')
      }
    },
  })

  useEffect(() => {
    // Load tickets on mount
    handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async () => {
    const query = searchQuery.trim()

    // If there's a search query, use search API; otherwise use fetch API
    const result = query
      ? await searchTickets(query, 100)
      : await fetchTickets(1000) // Admin can see all tickets

    if (result) {
      setTickets(result.tickets)
      setHasNewUpdates(false) // Clear notification badge after refresh
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as typeof activeTab)
    setFilters({ status: value === 'all' ? undefined : value })
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

    // Filter by region
    if (selectedRegion !== 'all') {
      const ticketRegion = REGIONS.find(r => r.value === selectedRegion)
      if (ticketRegion && ticket.group) {
        // R1: Check if ticket group matches selected region using canonical English name
        if (ticket.group.toLowerCase() !== ticketRegion.labelEn.toLowerCase()) return false
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
          <h1 className="text-3xl font-bold">Ticket Management</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all customer support tickets across all regions
          </p>
        </div>

        {/* SSE Status Indicator */}
        <div className="flex items-center gap-2">
          {hasNewUpdates && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              New Updates
            </Badge>
          )}
          {isConnected ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Wifi className="h-4 w-4" />
              <span>Live</span>
            </div>
          ) : sseState === 'connecting' ? (
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <WifiOff className="h-4 w-4 animate-pulse" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <WifiOff className="h-4 w-4" />
              <span>Offline</span>
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
              placeholder="Search tickets by number, title, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
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
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportTickets}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All Tickets
            {activeTab === 'all' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open">
            Open
            {activeTab === 'open' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {activeTab === 'pending' && (
              <span className="ml-2 text-xs">({filteredTickets.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed
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

