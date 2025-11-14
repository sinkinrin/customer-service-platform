/**
 * Staff Conversation Detail Page
 *
 * Allows staff to view and respond to customer conversations,
 * including AI conversation history after transfer to human
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { MessageList } from '@/components/conversation/message-list'
import { MessageInput } from '@/components/conversation/message-input'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { useSSE } from '@/lib/hooks/use-sse'
import { AlertCircle, ArrowLeft, User, Mail, Clock, MessageSquare } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'

export default function StaffConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false)

  const {
    activeConversation,
    messages,
    isLoadingMessages,
    isSendingMessage,
    isTyping,
    typingUser,
    fetchMessages,
    fetchConversationById,
    sendMessage,
    subscribeToConversation,
  } = useConversation()

  // SSE connection for real-time updates
  const { state: sseState, isConnected, error: sseError } = useSSE({
    url: '/api/sse/conversations',
    enabled: true,
    onMessage: (event) => {
      console.log('[SSE] Received event:', event)

      // Handle new message
      if (event.type === 'new_message' && event.conversationId === conversationId) {
        setShowNewMessageNotification(true)
        setTimeout(() => setShowNewMessageNotification(false), 3000)
        fetchMessages(conversationId)
      }

      // Handle conversation updated
      if (event.type === 'conversation_updated' && event.conversationId === conversationId) {
        fetchConversationById(conversationId)
      }

      // Handle conversation transferred (staff notification)
      if (event.type === 'conversation_transferred' && event.conversationId === conversationId) {
        console.log('[SSE] Conversation transferred - reloading')
        fetchConversationById(conversationId)
        fetchMessages(conversationId)
      }
    },
    onError: (error) => {
      console.error('[SSE] Error:', error)
    },
  })

  // Fetch conversation and messages, and mark as read
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId)
      fetchMessages(conversationId)

      // Mark conversation as read when entering
      fetch(`/api/conversations/${conversationId}/mark-read`, {
        method: 'POST',
      }).catch((error) => {
        console.error('Failed to mark conversation as read:', error)
      })
    }
  }, [conversationId, fetchConversationById, fetchMessages])

  // Subscribe to real-time updates
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = subscribeToConversation(conversationId)
      return unsubscribe
    }
  }, [conversationId, subscribeToConversation])

  // Handle sending message
  const handleSendMessage = async (
    content: string,
    messageType?: 'text' | 'image' | 'file',
    metadata?: Record<string, unknown>
  ) => {
    try {
      await sendMessage(conversationId, content, messageType, metadata)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    }
  }

  // Handle close conversation
  const handleCloseConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to close conversation')
      }

      toast.success('Conversation closed')
      await fetchConversationById(conversationId)
    } catch (error) {
      console.error('Close conversation error:', error)
      toast.error('Failed to close conversation')
    }
  }

  if (!activeConversation && isLoadingMessages) {
    return <Loading fullScreen text="Loading conversation..." />
  }

  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Conversation not found</h2>
        <p className="text-muted-foreground">The conversation you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => router.push('/staff/conversations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </div>
    )
  }

  const customer = activeConversation.customer
  const conversationStatus = activeConversation.status || 'active'
  const isClosed = conversationStatus === 'closed'
  const conversationMode = activeConversation.mode || 'ai'
  const transferredAt = activeConversation.transferred_at
  const transferReason = activeConversation.transfer_reason

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'secondary'
      case 'active':
        return 'default'
      case 'closed':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-64 top-16 flex">
      {/* Main Conversation Area - 70% */}
      <div className="flex-1 flex flex-col border-r">
        {/* SSE Connection Status */}
        {sseState === 'error' && sseError && (
          <Alert variant="destructive" className="m-4 mb-0 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Real-time updates unavailable: {sseError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* New Message Notification */}
        {showNewMessageNotification && (
          <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              New message received - scroll down to view
            </AlertDescription>
          </Alert>
        )}

        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 border-b bg-background shadow-sm">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/staff/conversations')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
                <div>
                  <h1 className="text-xl font-bold">与 {customer?.full_name || '客户'} 的对话</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                      {conversationStatus}
                    </Badge>
                    <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                      {conversationMode === 'ai' ? 'AI' : 'Human'}
                    </Badge>
                    {isConnected && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        🟢 已连接
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {!isClosed && (
                <Button variant="destructive" size="sm" onClick={handleCloseConversation}>
                  关闭对话
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="container max-w-4xl py-4">
            <MessageList
              messages={messages}
              isLoading={isLoadingMessages}
              isTyping={isTyping}
              typingUser={typingUser}
            />
          </div>
        </div>

        {/* Input - Sticky Bottom */}
        {!isClosed && (
          <div className="sticky bottom-0 z-10 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <MessageInput
              onSend={handleSendMessage}
              isSending={isSendingMessage}
              disabled={isClosed}
              placeholder="输入回复..."
            />
          </div>
        )}

        {isClosed && (
          <div className="sticky bottom-0 z-10 border-t bg-muted p-4">
            <div className="container max-w-4xl text-center">
              <p className="text-sm text-muted-foreground">
                对话已关闭
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Customer Info Sidebar - 30% - Fixed height, internal scroll */}
      <div className="w-96 bg-muted/30 flex flex-col h-full">
        <div className="overflow-y-auto p-6 space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              客户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {customer?.full_name?.charAt(0) || 'C'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{customer?.full_name || '未知客户'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {customer?.email || '无邮箱'}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">客户ID:</span>
                <span className="font-mono">{customer?.id || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              对话详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">状态:</span>
              <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                {conversationStatus === 'waiting' ? '等待中' : conversationStatus === 'active' ? '进行中' : '已关闭'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">模式:</span>
              <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                {conversationMode === 'ai' ? 'AI' : '人工'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">消息数:</span>
              <span>{messages.length}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">创建时间:</span>
              <span>{format(new Date(activeConversation.created_at), 'MM-dd HH:mm')}</span>
            </div>
            {activeConversation.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新时间:</span>
                <span>{format(new Date(activeConversation.updated_at), 'MM-dd HH:mm')}</span>
              </div>
            )}
            {transferredAt && (
              <>
                <Separator />
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    转人工时间:
                  </span>
                  <span>{format(new Date(transferredAt), 'MM-dd HH:mm')}</span>
                </div>
                {transferReason && (
                  <div className="bg-muted p-2 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">转人工原因:</p>
                    <p className="text-sm">{transferReason}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" disabled>
              查看客户历史
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              创建工单
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              添加内部备注
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
