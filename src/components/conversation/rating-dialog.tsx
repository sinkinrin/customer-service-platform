'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface RatingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  onRatingSubmitted?: () => void
}

export function RatingDialog({
  open,
  onOpenChange,
  conversationId,
  onRatingSubmitted,
}: RatingDialogProps) {
  const t = useTranslations('components.conversation.ratingDialog')
  const [score, setScore] = useState<number>(0)
  const [hoveredScore, setHoveredScore] = useState<number>(0)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (score === 0) {
      toast.error(t('pleaseSelectRating'))
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/conversations/${conversationId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          feedback: feedback.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || t('submitError'))
      }

      toast.success(t('submitSuccess'))
      onOpenChange(false)
      onRatingSubmitted?.()

      // Reset form
      setScore(0)
      setFeedback('')
    } catch (error: any) {
      console.error('[Rating] Submit error:', error)
      toast.error(error.message || t('submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onOpenChange(false)
    onRatingSubmitted?.()
  }

  const displayScore = hoveredScore || score

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  onMouseEnter={() => setHoveredScore(value)}
                  onMouseLeave={() => setHoveredScore(0)}
                  onClick={() => setScore(value)}
                  aria-label={t('starLabel', { score: value })}
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      value <= displayScore
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-muted text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            {displayScore > 0 && (
              <span className="text-sm text-muted-foreground">
                {t(`scoreLabels.${displayScore}`)}
              </span>
            )}
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-2">
            <label htmlFor="feedback" className="text-sm font-medium">
              {t('feedbackLabel')}
            </label>
            <Textarea
              id="feedback"
              placeholder={t('feedbackPlaceholder')}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/500
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting}>
            {t('skip')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || score === 0}>
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
