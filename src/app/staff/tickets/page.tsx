'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Wifi, WifiOff, Bell } from 'lucide-react'
import { TicketList } from '@/components/ticket/ticket-list'
import { useTicket } from '@/lib/hooks/use-ticket'
import { useTicketStore } from '@/lib/stores/ticket-store'
import { useSSE } from '@/lib/hooks/use-sse'
import { toast } from 'sonner'

export default function TicketsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'closed'>('all')
  const [hasNewUpdates, setHasNewUpdates] = useState(false)
  const { tickets, setTickets, setFilters } = useTicketStore()
  const { searchTickets, isLoading } = useTicket()

  // SSE connection for real-time updates
  const { state: sseState, isConnected } = useSSE({
    url: '/api/sse/tickets',
    enabled: true,
    onMessage: (event) => {
      if (event.type === 'ticket_updated' || event.type === 'ticket_created') {
        // Show notification badge
        setHasNewUpdates(true)

        // Show toast
        toast.info('Ticket updated - refresh to see changes')
      }
    },
  })

  useEffect(() => {
    // Load tickets on mount
    handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async () => {
    const query = searchQuery.trim() || 'state:*'
    const result = await searchTickets(query, 50)
    if (result) {
      setTickets(result.tickets)
      setHasNewUpdates(false) // Clear notification badge after refresh
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as typeof activeTab)
    setFilters({ status: value === 'all' ? undefined : value })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track customer support tickets
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

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets by number, title, or customer..."
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
          Search
        </Button>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
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

