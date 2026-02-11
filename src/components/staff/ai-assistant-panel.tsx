/**
 * Staff AI Assistant Panel
 *
 * Collapsible side panel in ticket detail page with 3 tabs:
 * 1. Suggest Reply - Generate AI reply draft
 * 2. AI Chat - Knowledge Q&A within ticket context
 * 3. Summary - One-click ticket summarization
 */

'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { MarkdownMessage } from '@/components/conversation/markdown-message'
import { cn } from '@/lib/utils'
import {
  Bot,
  Sparkles,
  MessageSquareText,
  FileText,
  Send,
  Loader2,
  Copy,
  Check,
  ArrowDownToLine,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface ArticleData {
  id: number
  sender: string
  body: string
  internal: boolean
  created_at: string
}

interface AiAssistantPanelProps {
  ticketTitle: string
  ticketState?: string
  ticketPriority?: string
  customerName?: string
  articles: ArticleData[]
  onInsertReply: (text: string) => void
  onClose: () => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function AiAssistantPanel({
  ticketTitle,
  ticketState,
  ticketPriority,
  customerName,
  articles,
  onInsertReply,
  onClose,
}: AiAssistantPanelProps) {
  const t = useTranslations('staff.ai')

  // Suggest Reply state
  const [suggestedReply, setSuggestedReply] = useState('')
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [replyCopied, setReplyCopied] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const msgIdCounter = useRef(0)
  const idPrefix = useId()

  // Summary state
  const [summary, setSummary] = useState('')
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)

  // Auto-scroll chat via ScrollArea viewport
  const scrollChatToBottom = useCallback(() => {
    const viewport = chatScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [])

  useEffect(() => {
    scrollChatToBottom()
  }, [chatMessages.length, isChatLoading, scrollChatToBottom])

  const buildArticlesPayload = useCallback(() => {
    return articles.map(a => ({
      sender: a.sender,
      body: a.body,
      internal: a.internal,
      created_at: a.created_at,
    }))
  }, [articles])

  // ──── Suggest Reply ────
  const handleSuggestReply = async () => {
    setIsGeneratingReply(true)
    setSuggestedReply('')
    try {
      const res = await fetch('/api/staff/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTitle,
          ticketState,
          ticketPriority,
          customerName,
          articles: buildArticlesPayload(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      setSuggestedReply(data.data.suggestedReply)
    } catch (error) {
      toast.error(t('error'))
      console.error('Suggest reply error:', error)
    } finally {
      setIsGeneratingReply(false)
    }
  }

  const handleInsertReply = () => {
    onInsertReply(suggestedReply)
    toast.success(t('inserted'))
  }

  const handleCopyReply = async () => {
    try {
      await navigator.clipboard.writeText(suggestedReply)
    } catch {
      // Fallback for older browsers or unfocused document
      const textarea = document.createElement('textarea')
      textarea.value = suggestedReply
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setReplyCopied(true)
    setTimeout(() => setReplyCopied(false), 2000)
  }

  // ──── Chat ────
  const handleChatSend = async () => {
    const msg = chatInput.trim()
    if (!msg || isChatLoading) return

    const userMsg: ChatMessage = {
      id: `${idPrefix}-user-${++msgIdCounter.current}`,
      role: 'user',
      content: msg,
    }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const res = await fetch('/api/staff/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatMessages.map(m => ({ role: m.role, content: m.content })),
          ticketContext: {
            ticketTitle,
            customerName,
            articles: buildArticlesPayload().slice(-5), // Last 5 articles for context
          },
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')

      const aiMsg: ChatMessage = {
        id: `${idPrefix}-ai-${++msgIdCounter.current}`,
        role: 'assistant',
        content: data.data.message,
      }
      setChatMessages(prev => [...prev, aiMsg])
    } catch (error) {
      toast.error(t('error'))
      console.error('Chat error:', error)
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  }

  // ──── Summary ────
  const handleSummarize = async () => {
    setIsGeneratingSummary(true)
    setSummary('')
    try {
      const res = await fetch('/api/staff/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTitle,
          ticketState,
          ticketPriority,
          customerName,
          articles: buildArticlesPayload(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed')
      setSummary(data.data.summary)
    } catch (error) {
      toast.error(t('error'))
      console.error('Summarize error:', error)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-500/5 to-purple-500/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-violet-500/10">
            <Bot className="h-4 w-4 text-violet-600" />
          </div>
          <span className="font-semibold text-sm">{t('title')}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suggest" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-3 h-9">
          <TabsTrigger value="suggest" className="text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            {t('tabs.suggest')}
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs gap-1">
            <MessageSquareText className="h-3 w-3" />
            {t('tabs.chat')}
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs gap-1">
            <FileText className="h-3 w-3" />
            {t('tabs.summary')}
          </TabsTrigger>
        </TabsList>

        {/* ──── Suggest Reply Tab ──── */}
        <TabsContent value="suggest" className="flex-1 flex-col min-h-0 mt-0 data-[state=active]:flex">
          {!suggestedReply && !isGeneratingReply ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-4">
              <div className="p-3 rounded-full bg-violet-500/10">
                <Sparkles className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-sm text-muted-foreground">{t('suggest.description')}</p>
              <Button onClick={handleSuggestReply} className="gap-2" size="sm">
                <Sparkles className="h-4 w-4" />
                {t('suggest.generate')}
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                  {isGeneratingReply ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      <span className="text-sm text-muted-foreground">{t('suggest.generating')}</span>
                    </div>
                  ) : (
                    <div className="min-h-[200px] bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                      <MarkdownMessage content={suggestedReply} className="text-sm" />
                    </div>
                  )}
                </div>
              </ScrollArea>
              {suggestedReply && (
                <div className="flex gap-2 p-3 border-t bg-background">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={handleInsertReply}>
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    {t('suggest.insert')}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopyReply}>
                    {replyCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {replyCopied ? t('copied') : t('copy')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleSuggestReply}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ──── Chat Tab ──── */}
        <TabsContent value="chat" className="flex-1 flex-col min-h-0 mt-0 data-[state=active]:flex">
          <ScrollArea className="flex-1 min-h-0" ref={chatScrollRef}>
            <div className="space-y-4 p-4">
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('chat.placeholder')}
                </p>
              )}
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="markdown-container">
                        {msg.content ? (
                          <MarkdownMessage content={msg.content} className="text-sm" />
                        ) : (
                          <span className="text-muted-foreground italic text-xs">(Empty message)</span>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse" />
                      <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-violet-500/60 rounded-full animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 p-3 border-t bg-background">
            <Textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder={t('chat.inputPlaceholder')}
              className="resize-none min-h-[36px] max-h-[100px] text-sm"
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={handleChatSend}
              disabled={!chatInput.trim() || isChatLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        {/* ──── Summary Tab ──── */}
        <TabsContent value="summary" className="flex-1 flex-col min-h-0 mt-0 data-[state=active]:flex">
          {!summary && !isGeneratingSummary ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
              <div className="p-3 rounded-full bg-violet-500/10">
                <FileText className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-sm text-muted-foreground">{t('summary.description')}</p>
              <Button onClick={handleSummarize} className="gap-2" size="sm">
                <FileText className="h-4 w-4" />
                {t('summary.generate')}
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                {isGeneratingSummary ? (
                  <div className="flex items-center gap-2 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    <span className="text-sm text-muted-foreground">{t('summary.generating')}</span>
                  </div>
                ) : (
                  <div className="p-4">
                    <MarkdownMessage content={summary} className="text-sm" />
                  </div>
                )}
              </ScrollArea>
              {summary && (
                <div className="flex gap-2 p-3 border-t bg-background">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSummarize}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t('summary.regenerate')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  )
}
