'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  RotateCcw,
} from 'lucide-react'
import type { QaRound, QaStats, FilterStatus } from '@/lib/ai-qa/types'

export default function StaffAiQaPage() {
  const t = useTranslations('staff.aiQa')

  // State
  const [rounds, setRounds] = useState<QaRound[]>([])
  const [stats, setStats] = useState<QaStats>({ total: 0, unreviewed: 0, correct: 0, incorrect: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState<QaRound | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  // Review state
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Retest state
  const [retesting, setRetesting] = useState(false)
  const [retestResult, setRetestResult] = useState<{
    originalAnswer: string
    retestAnswer: string
    retestAt: string
  } | null>(null)

  const fetchRounds = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        from: dateFrom,
        to: dateTo,
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/staff/ai-qa/rounds?${params}`)
      const json = await res.json()
      if (json.success) {
        setRounds(json.data.rounds)
        setTotal(json.data.total)
        setStats(json.data.stats)
      } else {
        toast.error(t('toast.loadError'))
      }
    } catch {
      toast.error(t('toast.loadError'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dateFrom, dateTo, page, pageSize, t])

  useEffect(() => {
    fetchRounds()
  }, [fetchRounds])

  // When filters change, reset to page 1
  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo])

  const handleReview = async (status: 'correct' | 'incorrect') => {
    if (!selectedRound) return
    setSaving(true)
    try {
      const res = await fetch('/api/staff/ai-qa/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedRound.messageId,
          status,
          reviewNote: reviewNote || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(t('toast.reviewSuccess'))
        // Update local state
        setSelectedRound({
          ...selectedRound,
          reviewStatus: status,
          reviewNote: reviewNote || null,
        })
        setRounds((prev) =>
          prev.map((r) =>
            r.messageId === selectedRound.messageId
              ? { ...r, reviewStatus: status, reviewNote: reviewNote || null }
              : r
          )
        )
        // Refresh stats
        fetchRounds()
      } else {
        toast.error(json.error?.message || t('toast.reviewError'))
      }
    } catch {
      toast.error(t('toast.reviewError'))
    } finally {
      setSaving(false)
    }
  }

  const handleRetest = async () => {
    if (!selectedRound) return
    setRetesting(true)
    setRetestResult(null)
    try {
      const res = await fetch('/api/staff/ai-qa/retest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selectedRound.messageId }),
      })
      const json = await res.json()
      if (json.success) {
        setRetestResult(json.data)
        toast.success(t('toast.retestSuccess'))
        // Update local state with retest answer
        setSelectedRound({
          ...selectedRound,
          retestAnswer: json.data.retestAnswer,
          retestAt: json.data.retestAt,
        })
        setRounds((prev) =>
          prev.map((r) =>
            r.messageId === selectedRound.messageId
              ? { ...r, retestAnswer: json.data.retestAnswer, retestAt: json.data.retestAt }
              : r
          )
        )
      } else {
        toast.error(json.error?.message || t('toast.retestError'))
      }
    } catch {
      toast.error(t('toast.retestError'))
    } finally {
      setRetesting(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      const res = await fetch(`/api/staff/ai-qa/export?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-qa-export-${dateFrom}_${dateTo}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('toast.exportSuccess'))
    } catch {
      toast.error(t('toast.exportError'))
    }
  }

  const selectRound = (round: QaRound) => {
    setSelectedRound(round)
    setReviewNote(round.reviewNote || '')
    setRetestResult(
      round.retestAnswer
        ? {
            originalAnswer: round.answer,
            retestAnswer: round.retestAnswer,
            retestAt: round.retestAt || '',
          }
        : null
    )
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  const getRatingColor = (rating: string | null) => {
    if (rating === 'negative') return 'border-l-4 border-l-red-400'
    if (rating === 'positive') return 'border-l-4 border-l-green-400'
    return 'border-l-4 border-l-transparent'
  }

  const getStatusBadge = (status: string | null) => {
    if (status === 'correct') {
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />{t('detail.correct')}</Badge>
    }
    if (status === 'incorrect') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t('detail.incorrect')}</Badge>
    }
    return <Badge variant="secondary">{t('detail.unreviewed')}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            {t('actions.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchRounds}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('actions.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {t('filters.status')}:
              </label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="unreviewed">{t('filters.unreviewed')}</SelectItem>
                  <SelectItem value="correct">{t('filters.correct')}</SelectItem>
                  <SelectItem value="incorrect">{t('filters.incorrect')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {t('filters.dateRange')}:
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex items-center gap-3 ml-auto text-sm text-muted-foreground">
              <span>{t('stats.total')}: <strong className="text-foreground">{stats.total}</strong></span>
              <span>|</span>
              <span>{t('stats.unreviewed')}: <strong className="text-foreground">{stats.unreviewed}</strong></span>
              <span>{t('stats.correct')}: <strong className="text-green-600">{stats.correct}</strong></span>
              <span>{t('stats.incorrect')}: <strong className="text-red-600">{stats.incorrect}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content: left list + right detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Q&A List */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t('list.loading')}</span>
                </div>
              ) : rounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                  <p>{t('list.empty')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rounds.map((round) => (
                    <button
                      key={round.messageId}
                      className={`w-full text-left p-4 hover:bg-accent/50 transition-colors ${
                        getRatingColor(round.customerRating)
                      } ${selectedRound?.messageId === round.messageId ? 'bg-accent' : ''}`}
                      onClick={() => selectRound(round)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{round.question || t('detail.noQuestion')}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            AI: {round.answer.slice(0, 80)}{round.answer.length > 80 ? '...' : ''}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {round.customerRating === 'negative' && (
                              <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                            )}
                            {round.customerRating === 'positive' && (
                              <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                            )}
                            {round.customerFeedback && (
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                &quot;{round.customerFeedback}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {getStatusBadge(round.reviewStatus)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(round.qaTime), 'MM/dd HH:mm')}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t('list.prev')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page}/{totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    {t('list.next')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Detail Panel */}
        <div className="lg:col-span-3">
          {selectedRound ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('detail.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Question */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t('detail.question')}</h4>
                  <p className="text-sm bg-muted/50 rounded-md p-3">
                    {selectedRound.question || t('detail.noQuestion')}
                  </p>
                </div>

                {/* AI Answer */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t('detail.answer')}</h4>
                  <p className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                    {selectedRound.answer}
                  </p>
                </div>

                {/* Customer Rating */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">{t('detail.customerRating')}</h4>
                  <div className="flex items-center gap-2">
                    {selectedRound.customerRating === 'positive' && (
                      <>
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">{t('detail.ratingPositive')}</span>
                      </>
                    )}
                    {selectedRound.customerRating === 'negative' && (
                      <>
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-600">{t('detail.ratingNegative')}</span>
                      </>
                    )}
                    {!selectedRound.customerRating && (
                      <span className="text-sm text-muted-foreground">{t('detail.noRating')}</span>
                    )}
                    {selectedRound.customerFeedback && (
                      <span className="text-sm text-muted-foreground ml-2">
                        &quot;{selectedRound.customerFeedback}&quot;
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{t('detail.source')}: {t('detail.platform')}</span>
                  <span>|</span>
                  <span>{selectedRound.customerEmail}</span>
                  <span>|</span>
                  <span>{format(new Date(selectedRound.qaTime), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>

                {/* Divider */}
                <hr />

                {/* Review Actions */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('detail.reviewStatus')}</h4>
                  <div className="flex items-center gap-2 mb-3">
                    <Button
                      size="sm"
                      variant={selectedRound.reviewStatus === 'correct' ? 'default' : 'outline'}
                      className={selectedRound.reviewStatus === 'correct' ? 'bg-green-600 hover:bg-green-700' : ''}
                      onClick={() => handleReview('correct')}
                      disabled={saving}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t('actions.markCorrect')}
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedRound.reviewStatus === 'incorrect' ? 'destructive' : 'outline'}
                      onClick={() => handleReview('incorrect')}
                      disabled={saving}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {t('actions.markIncorrect')}
                    </Button>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <Textarea
                    placeholder={t('actions.notePlaceholder')}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Divider */}
                <hr />

                {/* Retest Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">{t('detail.retestTitle')}</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetest}
                      disabled={retesting}
                    >
                      {retesting ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      {t('actions.retest')}
                    </Button>
                  </div>

                  {(retestResult || selectedRound.retestAnswer) && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.originalAnswer')}</p>
                        <div className="text-sm bg-red-50 dark:bg-red-950/30 rounded-md p-3 whitespace-pre-wrap">
                          {retestResult?.originalAnswer || selectedRound.answer}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.retestAnswer')}</p>
                        <div className="text-sm bg-green-50 dark:bg-green-950/30 rounded-md p-3 whitespace-pre-wrap">
                          {retestResult?.retestAnswer || selectedRound.retestAnswer}
                        </div>
                      </div>
                      {(retestResult?.retestAt || selectedRound.retestAt) && (
                        <p className="text-xs text-muted-foreground">
                          {t('detail.retestTime')}: {format(new Date(retestResult?.retestAt || selectedRound.retestAt!), 'yyyy-MM-dd HH:mm:ss')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
                <p>{t('detail.selectHint')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
