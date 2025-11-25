'use client'

import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (user?.email) {
      fetchTickets(1)
    }
  }, [user])

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = tickets.filter(ticket =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.number.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredTickets(filtered)
    } else {
      setFilteredTickets(tickets)
    }
  }, [searchQuery, tickets])

  const fetchTickets = async (pageToLoad: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      // Search for tickets by user email
      const response = await fetch(`/api/tickets?query=${encodeURIComponent(user?.email || '')}&limit=50&page=${pageToLoad}`)

      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()
      const newTickets = data.data.tickets || []

      if (append) {
        setTickets(prev => [...prev, ...newTickets])
      } else {
        setTickets(newTickets)
      }

      setHasMore(data.data.hasMore || false)
      setPage(pageToLoad)
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/customer/my-tickets/${ticket.id}`)}
                  >
                    <TableCell className="font-medium">#{ticket.number}</TableCell>
                    <TableCell className="max-w-md truncate">{ticket.title}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/customer/my-tickets/${ticket.id}`)
                        }}
                      >
                        {t('table.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Load More Button */}
          {!loading && hasMore && (
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

