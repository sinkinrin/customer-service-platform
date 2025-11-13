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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Fetch conversation and messages
  useEffect(() => {
    if (conversationId) {
      fetchConversationById(conversationId)
      fetchMessages(conversationId)
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
        <p className="text-muted-foreground">The conversation you're looking for doesn't exist.</p>
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Conversation Area - 70% */}
      <div className="flex-1 flex flex-col border-r">
        {/* SSE Connection Status */}
        {sseState === 'error' && sseError && (
          <Alert variant="destructive" className="m-4 mb-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Real-time updates unavailable: {sseError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* New Message Notification */}
        {showNewMessageNotification && (
          <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              New message received - scroll down to view
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="border-b p-4 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/staff/conversations')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Conversation with {customer?.full_name || 'Customer'}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                    {conversationStatus}
                  </Badge>
                  <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                    {conversationMode === 'ai' ? 'AI' : 'Human'}
                  </Badge>
                  {isConnected && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      🟢 Connected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {!isClosed && (
              <Button variant="destructive" onClick={handleCloseConversation}>
                Close Conversation
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <div className="container max-w-4xl h-full">
            <MessageList
              messages={messages}
              isLoading={isLoadingMessages}
              isTyping={isTyping}
              typingUser={typingUser}
            />
          </div>
        </div>

        {/* Input - Fixed at bottom */}
        {!isClosed && (
          <MessageInput
            onSend={handleSendMessage}
            isSending={isSendingMessage}
            disabled={isClosed}
            placeholder="Type your response..."
          />
        )}

        {isClosed && (
          <div className="border-t bg-muted p-4">
            <div className="container max-w-4xl text-center">
              <p className="text-sm text-muted-foreground">
                This conversation has been closed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Customer Info Sidebar - 30% */}
      <div className="w-96 overflow-y-auto bg-muted/30 p-6 space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
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
                <p className="font-semibold">{customer?.full_name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {customer?.email || 'No email'}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer ID:</span>
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
              Conversation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={getStatusBadgeVariant(conversationStatus)}>
                {conversationStatus}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode:</span>
              <Badge variant={conversationMode === 'ai' ? 'default' : 'secondary'}>
                {conversationMode === 'ai' ? 'AI' : 'Human'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Messages:</span>
              <span>{messages.length}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{format(new Date(activeConversation.created_at), 'MMM d, HH:mm')}</span>
            </div>
            {activeConversation.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated:</span>
                <span>{format(new Date(activeConversation.updated_at), 'MMM d, HH:mm')}</span>
              </div>
            )}
            {transferredAt && (
              <>
                <Separator />
                <div className="flex items-start justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Transferred:
                  </span>
                  <span>{format(new Date(transferredAt), 'MMM d, HH:mm')}</span>
                </div>
                {transferReason && (
                  <div className="bg-muted p-2 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Transfer Reason:</p>
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
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" disabled>
              View Customer History
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              Create Ticket
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              Add Internal Note
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
