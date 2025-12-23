'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface TicketReopenButtonProps {
  ticketId: number
  onSuccess?: () => void
}

export function TicketReopenButton({ ticketId, onSuccess }: TicketReopenButtonProps) {
  const t = useTranslations('tickets.reopen')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleReopen = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
      })

      if (res.ok) {
        toast.success(t('success'))
        setOpen(false)
        onSuccess?.()
      } else {
        const data = await res.json()
        toast.error(data.error?.message || t('error'))
      }
    } catch (error) {
      console.error('Failed to reopen ticket:', error)
      toast.error(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('button')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dialogDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleReopen} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
