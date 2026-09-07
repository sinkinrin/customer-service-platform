'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Search, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { getAuthorizationIdentityKey } from '@/lib/auth/authorization-identity'
import { useTranslations } from 'next-intl'

interface Ticket {
  id: number
  number: string
  title: string
  state_id: number
  priority_id: number
  created_at: string
  updated_at: string
  article_count: number
}

interface TicketListState {
  identityKey: string
  tickets: Ticket[]
  page: number
  hasMore: boolean
}

interface TicketSearchState {
  identityKey: string
  query: string
}

const priorityVariants: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  1: 'secondary',
  2: 'default',
  3: 'destructive',
  4: 'destructive',
}

const stateVariants: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  1: 'default',
  2: 'outline',
  3: 'secondary',
  4: 'secondary',
}

export default function MyTicketsPage() {
  const t = useTranslations('myTickets')
  const router = useRouter()
  const { user } = useAuth()
  const userEmail = user?.email || ''
  const ticketIdentityKey = getAuthorizationIdentityKey(user) ?? ''
  const loadErrorMessage = t('toast.loadError')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [ticketSearch, setTicketSearch] = useState<TicketSearchState>(() => ({
    identityKey: ticketIdentityKey,
    query: '',
  }))
  const [ticketList, setTicketList] = useState<TicketListState>(() => ({
    identityKey: ticketIdentityKey,
    tickets: [],
    page: 1,
    hasMore: false,
  }))
  const activeIdentityKeyRef = useRef(ticketIdentityKey)
  const requestSequenceRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadErrorMessageRef = useRef(loadErrorMessage)

  // Hide the previous identity's data during render, before effect cleanup.
  activeIdentityKeyRef.current = ticketIdentityKey
  loadErrorMessageRef.current = loadErrorMessage

  const ticketListIsCurrent = ticketList.identityKey === ticketIdentityKey
  const searchQuery = ticketSearch.identityKey === ticketIdentityKey ? ticketSearch.query : ''
  const page = ticketListIsCurrent ? ticketList.page : 1
  const hasMore = ticketListIsCurrent ? ticketList.hasMore : false
  const displayLoading = loading || (!!userEmail && !ticketListIsCurrent)
  const filteredTickets = useMemo(() => {
    const currentTickets = ticketList.identityKey === ticketIdentityKey
      ? ticketList.tickets
      : []

    if (!searchQuery.trim()) return currentTickets

    const normalizedQuery = searchQuery.toLowerCase()
    return currentTickets.filter(ticket =>
      ticket.title.toLowerCase().includes(normalizedQuery) ||
      ticket.number.toLowerCase().includes(normalizedQuery)
    )
  }, [searchQuery, ticketIdentityKey, ticketList])

  const fetchTickets = useCallback(async (
    pageToLoad: number,
    append: boolean = false,
    background: boolean = false
  ) => {
    if (!ticketIdentityKey || !userEmail) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    const requestSequence = ++requestSequenceRef.current
    abortControllerRef.current = controller
    const isCurrentRequest = () =>
      !controller.signal.aborted &&
      requestSequenceRef.current === requestSequence &&
      activeIdentityKeyRef.current === ticketIdentityKey

    if (append) {
      setLoadingMore(true)
    } else if (!background) {
      setLoading(true)
    }

    try {
      // Search for tickets by user email
      const response = await fetch(
        `/api/tickets?query=${encodeURIComponent(userEmail)}&limit=50&page=${pageToLoad}`,
        { signal: controller.signal }
      )

      if (!isCurrentRequest()) return

      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()
      if (!isCurrentRequest()) return

      const newTickets = data.data.tickets || []
      setTicketList((previous) => ({
        identityKey: ticketIdentityKey,
        tickets: append && previous.identityKey === ticketIdentityKey
          ? [...previous.tickets, ...newTickets]
          : newTickets,
        page: pageToLoad,
        hasMore: data.data.hasMore || false,
      }))
    } catch (error) {
      if (
        controller.signal.aborted ||
        !isCurrentRequest() ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }

      console.error('Failed to fetch tickets:', error)
      toast.error(loadErrorMessageRef.current)
    } finally {
      if (isCurrentRequest()) {
        setLoading(false)
        setLoadingMore(false)
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [ticketIdentityKey, userEmail])

  useEffect(() => {
    requestSequenceRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setTicketSearch({ identityKey: ticketIdentityKey, query: '' })
    setTicketList({ identityKey: ticketIdentityKey, tickets: [], page: 1, hasMore: false })
    setLoadingMore(false)

    if (!ticketIdentityKey || !userEmail) {
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchTickets(1)

    return () => {
      requestSequenceRef.current += 1
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
    }
  }, [fetchTickets, ticketIdentityKey, userEmail])

  useEffect(() => {
    if (!ticketIdentityKey || !userEmail) return

    const handleTicketUpdate = () => {
      // A listener from the previous authorization identity can remain active
      // until effect cleanup runs. Never let it start a request for that old
      // identity after the current render has already switched users/roles.
      if (activeIdentityKeyRef.current !== ticketIdentityKey) return
      void fetchTickets(1, false, true)
    }

    window.addEventListener('ticket-update', handleTicketUpdate)
    return () => window.removeEventListener('ticket-update', handleTicketUpdate)
  }, [fetchTickets, ticketIdentityKey, userEmail])

  const handleLoadMore = () => {
    const nextPage = page + 1
    fetchTickets(nextPage, true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('listTitle')}</CardTitle>
              <CardDescription>
                {t('listDescription', { count: filteredTickets.length })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setTicketSearch({
                    identityKey: ticketIdentityKey,
                    query: e.target.value,
                  })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? t('empty.noResults') : t('empty.description')}
              </p>
              {!searchQuery && (
                <p className="text-sm text-muted-foreground">
                  {t('empty.hint')}
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.id')}</TableHead>
                  <TableHead>{t('table.title')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.priority')}</TableHead>
                  <TableHead>{t('table.replies')}</TableHead>
                  <TableHead>{t('table.created')}</TableHead>
                  <TableHead>{t('table.updated')}</TableHead>
                  <TableHead className="text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer focus-within:bg-muted/50"
                    onClick={(event) => {
                      // Preserve native links, modified clicks and text selection.
                      if (
                        event.defaultPrevented || event.button !== 0 ||
                        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
                        (event.target as HTMLElement).closest('a, button, input, select, textarea') ||
                        window.getSelection()?.toString()
                      ) return
                      router.push(`/customer/my-tickets/${ticket.id}`)
                    }}
                  >
                    <TableCell className="font-medium">#{ticket.number}</TableCell>
                    <TableCell className="max-w-md truncate">
                      <Link href={`/customer/my-tickets/${ticket.id}`} className="hover:underline focus-visible:underline">
                        {ticket.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateVariants[ticket.state_id] || 'default'}>
                        {t((['1','2','3','4'].includes(String(ticket.state_id)) ? `status.${ticket.state_id}` : 'status.unknown') as any)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariants[ticket.priority_id] || 'default'}>
                        {t((['1','2','3','4'].includes(String(ticket.priority_id)) ? `priority.${ticket.priority_id}` : 'priority.unknown') as any)}
                      </Badge>
                    </TableCell>
                    <TableCell>{ticket.article_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(ticket.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(ticket.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/customer/my-tickets/${ticket.id}`}
                          aria-label={`${t('table.view')} #${ticket.number}: ${ticket.title}`}
                        >
                          {t('table.view')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Load More Button */}
          {!displayLoading && hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('table.loading')}
                  </>
                ) : (
                  t('table.loadMore')
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

