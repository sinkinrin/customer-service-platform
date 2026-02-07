/**
 * Feedback Dialog Component
 *
 * Shown when a user clicks thumbs down on an AI message.
 * Collects optional feedback text before submitting the negative rating.
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (feedback?: string) => void
}

export function FeedbackDialog({ open, onOpenChange, onSubmit }: FeedbackDialogProps) {
  const t = useTranslations('aiChat.feedback')
  const [feedback, setFeedback] = useState('')

  const handleSubmit = () => {
    onSubmit(feedback.trim() || undefined)
    setFeedback('')
    onOpenChange(false)
  }

  const handleSkip = () => {
    onSubmit(undefined)
    setFeedback('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t('placeholder')}
            className="min-h-[100px] resize-none"
            maxLength={2000}
          />
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            {t('skip')}
          </Button>
          <Button onClick={handleSubmit}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
