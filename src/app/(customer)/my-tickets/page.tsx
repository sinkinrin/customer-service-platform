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

const priorityMap: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  1: { label: '低', variant: 'secondary' },
  2: { label: '中', variant: 'default' },
  3: { label: '高', variant: 'destructive' },
  4: { label: '紧急', variant: 'destructive' },
}

const stateMap: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  1: { label: '新建', variant: 'default' },
  2: { label: '处理中', variant: 'outline' },
  3: { label: '待回复', variant: 'secondary' },
  4: { label: '已关闭', variant: 'secondary' },
}

export default function MyTicketsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])

  useEffect(() => {
    if (user?.email) {
      fetchTickets()
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

  const fetchTickets = async () => {
    setLoading(true)
    try {
      // Search for tickets by user email
      const response = await fetch(`/api/tickets?query=${encodeURIComponent(user?.email || '')}&limit=50`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()
      setTickets(data.data.tickets || [])
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-3xl font-bold">我的工单</h1>
          <p className="text-muted-foreground mt-2">
            查看和管理您提交的所有工单
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>工单列表</CardTitle>
              <CardDescription>
                共 {filteredTickets.length} 个工单
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索工单标题或编号..."
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
              <h3 className="text-lg font-semibold mb-2">暂无工单</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? '没有找到匹配的工单' : '您还没有提交任何工单'}
              </p>
              {!searchQuery && (
                <p className="text-sm text-muted-foreground">
                  请通过在线咨询创建工单
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>工单编号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>回复数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/staff/tickets/${ticket.id}`)}
                  >
                    <TableCell className="font-medium">#{ticket.number}</TableCell>
                    <TableCell className="max-w-md truncate">{ticket.title}</TableCell>
                    <TableCell>
                      <Badge variant={stateMap[ticket.state_id]?.variant || 'default'}>
                        {stateMap[ticket.state_id]?.label || '未知'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityMap[ticket.priority_id]?.variant || 'default'}>
                        {priorityMap[ticket.priority_id]?.label || '未知'}
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
                          router.push(`/staff/tickets/${ticket.id}`)
                        }}
                      >
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

