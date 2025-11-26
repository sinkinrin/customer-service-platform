/**
 * Transfer to Human Dialog Component
 *
 * Simplified confirmation dialog for transferring AI conversation to human agent
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { User, Loader2, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => Promise<void>
  isTransferring?: boolean
}

export function TransferDialog({
  open,
  onOpenChange,
  onConfirm,
  isTransferring = false,
}: TransferDialogProps) {
  const t = useTranslations('components.conversation.transferDialog')
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || undefined)
    setReason('') // Reset reason after transfer
  }

  const handleCancel = () => {
    if (!isTransferring) {
      setReason('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              {t('reasonLabel')}
            </Label>
            <Textarea
              id="reason"
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isTransferring}
              maxLength={300}
              className="resize-none h-20"
            />
            {reason.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {t('charCount', { count: reason.length })}
              </p>
            )}
          </div>

          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-900 dark:text-green-100">
              {t('continueInWindow')}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isTransferring}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isTransferring}
            className="bg-green-600 hover:bg-green-700"
          >
            {isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('confirming')}
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                {t('confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
