'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Send, Loader2, Clock, User, Tag } from 'lucide-react'
import { useTicket, type TicketArticle } from '@/lib/hooks/use-ticket'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function CustomerTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string
  
  const [ticket, setTicket] = useState<ZammadTicket | null>(null)
  const [articles, setArticles] = useState<TicketArticle[]>([])
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const { fetchTicketById, fetchArticles, isLoading } = useTicket()

  useEffect(() => {
    loadTicket()
    loadArticles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const loadTicket = async () => {
    const data = await fetchTicketById(ticketId)
    if (data) {
      setTicket(data)
    }
  }

  const loadArticles = async () => {
    const data = await fetchArticles(ticketId)
    setArticles(data)
  }

  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error('请输入回复内容')
      return
    }

    setSubmitting(true)
    try {
      // Call API directly instead of using addArticle hook
      const response = await fetch(`/api/tickets/${ticketId}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: `Re: ${ticket?.title || ''}`,
          body: replyText,
          type: 'web',
          internal: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '发送回复失败')
      }

      toast.success('回复已发送')
      setReplyText('')
      await loadArticles()
    } catch (error: any) {
      console.error('Failed to send reply:', error)
      toast.error(error.message || '发送回复失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (state: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      'new': { variant: 'default', label: '新建' },
      'open': { variant: 'default', label: '处理中' },
      'pending': { variant: 'secondary', label: '等待回复' },
      'closed': { variant: 'outline', label: '已关闭' },
    }
    const config = variants[state] || { variant: 'default', label: state }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getPriorityBadge = (priority: number) => {
    const variants: Record<number, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
      1: { variant: 'secondary', label: '低' },
      2: { variant: 'default', label: '中' },
      3: { variant: 'destructive', label: '高' },
      4: { variant: 'destructive', label: '紧急' },
    }
    const config = variants[priority] || { variant: 'default', label: String(priority) }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading || !ticket) {
    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/customer/my-tickets')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回工单列表
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{ticket.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                工单编号: #{ticket.number}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                创建时间: {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(ticket.state)}
            {getPriorityBadge(ticket.priority_id)}
          </div>
        </div>
      </div>

      {/* Ticket Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>工单信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">状态</p>
              <p className="mt-1">{getStatusBadge(ticket.state)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">优先级</p>
              <p className="mt-1">{getPriorityBadge(ticket.priority_id)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">创建时间</p>
              <p className="mt-1">{format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm:ss')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">最后更新</p>
              <p className="mt-1">{format(new Date(ticket.updated_at), 'yyyy-MM-dd HH:mm:ss')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles/Conversation History */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            对话记录
          </CardTitle>
          <CardDescription>
            共 {articles.length} 条消息
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">暂无对话记录</p>
          ) : (
            <div className="space-y-4">
              {articles.map((article, index) => (
                <div key={article.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {article.from || '未知用户'}
                        </span>
                        {article.internal && (
                          <Badge variant="secondary" className="text-xs">内部</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(article.created_at), 'yyyy-MM-dd HH:mm')}
                      </span>
                    </div>
                    <div className="pl-6">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {article.subject}
                      </p>
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap">{article.body}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Section - Only show if ticket is not closed */}
      {ticket.state !== 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle>添加回复</CardTitle>
            <CardDescription>
              您的回复将发送给技术支持团队
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="请输入您的回复..."
                rows={6}
                maxLength={2000}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {replyText.length}/2000 字符
                </p>
                <Button
                  onClick={handleReply}
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      发送回复
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {ticket.state === 'closed' && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              此工单已关闭。如需继续讨论，请创建新工单。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

