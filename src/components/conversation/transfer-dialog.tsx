/**
 * Transfer to Human Dialog Component
 *
 * Confirmation dialog for transferring AI conversation to human agent
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
import { User, Loader2 } from 'lucide-react'

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            转接人工客服
          </DialogTitle>
          <DialogDescription>
            您即将从 AI 对话转接至人工客服。人工客服将能够查看您之前与 AI 的完整对话记录。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              转接原因（可选）
            </Label>
            <Textarea
              id="reason"
              placeholder="请简要说明需要转接人工的原因，这将帮助客服更好地为您服务..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isTransferring}
              maxLength={500}
              className="resize-none h-24"
            />
            {reason.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {reason.length} / 500
              </p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              💡 <strong>提示：</strong>转接后，您将在同一对话窗口中继续与人工客服交流，无需跳转到其他页面。
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
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isTransferring}
          >
            {isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                转接中...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                确认转接
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
