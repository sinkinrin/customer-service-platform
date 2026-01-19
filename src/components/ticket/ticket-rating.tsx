'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThumbsUp, ThumbsDown, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface TicketRatingProps {
  ticketId: number
  isVisible?: boolean // Only show for closed tickets
}

interface RatingData {
  id: number
  ticketId: number
  rating: 'positive' | 'negative'
  reason?: string
  createdAt: string
}

export function TicketRating({ ticketId, isVisible = true }: TicketRatingProps) {
  const t = useTranslations('tickets.rating')
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingRating, setExistingRating] = useState<RatingData | null>(null)

  // Load existing rating on mount
  useEffect(() => {
    const loadRating = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/rating`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setExistingRating(data.data)
            setRating(data.data.rating)
            setReason(data.data.reason || '')
            setSubmitted(true)
          }
        }
      } catch (error) {
        console.error('Failed to load rating:', error)
      }
    }
    loadRating()
  }, [ticketId])

  const handleSubmit = async () => {
    if (!rating) return

    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, reason: reason.trim() || undefined }),
      })

      if (res.ok) {
        setSubmitted(true)
        toast.success(t('submitSuccess'))
      } else {
        const data = await res.json()
        toast.error(data.error?.message || t('submitError'))
      }
    } catch (error) {
      console.error('Failed to submit rating:', error)
      toast.error(t('submitError'))
    } finally {
      setLoading(false)
    }
  }

  if (!isVisible) return null

  if (submitted && existingRating) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="font-medium">{t('thankYou')}</span>
            {existingRating.rating === 'positive' ? (
              <ThumbsUp className="h-4 w-4 ml-2" />
            ) : (
              <ThumbsDown className="h-4 w-4 ml-2" />
            )}
          </div>
          {existingRating.reason && (
            <p className="mt-2 text-sm text-muted-foreground">{existingRating.reason}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        
        {/* Rating buttons */}
        <div className="flex gap-3">
          <Button
            variant={rating === 'positive' ? 'default' : 'outline'}
            className={rating === 'positive' ? 'bg-green-600 hover:bg-green-700' : ''}
            onClick={() => setRating('positive')}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            {t('positive')}
          </Button>
          <Button
            variant={rating === 'negative' ? 'default' : 'outline'}
            className={rating === 'negative' ? 'bg-red-600 hover:bg-red-700' : ''}
            onClick={() => setRating('negative')}
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            {t('negative')}
          </Button>
        </div>

        {/* Reason textarea (optional) */}
        {rating && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {rating === 'positive' ? t('positiveReason') : t('negativeReason')}
            </label>
            <Textarea
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Submit button */}
        {rating && (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('submit')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Compact rating indicator for ticket lists and headers
interface RatingIndicatorProps {
  rating?: 'positive' | 'negative' | null
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function RatingIndicator({ rating, size = 'sm', showLabel = false }: RatingIndicatorProps) {
  const t = useTranslations('tickets.rating')

  if (!rating) return null

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  if (rating === 'positive') {
    return (
      <span
        className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
        role="status"
        aria-label={t('satisfied')}
      >
        <ThumbsUp className={iconSize} aria-hidden="true" />
        {showLabel && <span className="text-xs">{t('positive')}</span>}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"
      role="status"
      aria-label={t('unsatisfied')}
    >
      <ThumbsDown className={iconSize} aria-hidden="true" />
      {showLabel && <span className="text-xs">{t('negative')}</span>}
    </span>
  )
}
