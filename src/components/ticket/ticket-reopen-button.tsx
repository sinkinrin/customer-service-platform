'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useAuth } from '@/lib/hooks/use-auth'
import { getAuthorizationIdentityKey } from '@/lib/auth/authorization-identity'

interface TicketReopenButtonProps {
  ticketId: number
  onSuccess?: () => void
}

export function TicketReopenButton({ ticketId, onSuccess }: TicketReopenButtonProps) {
  const t = useTranslations('tickets.reopen')
  const { user } = useAuth()
  const identityKey = getAuthorizationIdentityKey(user)
  const lifecycleKey = identityKey
    ? JSON.stringify({ identityKey, ticketId })
    : null
  const [dialogState, setDialogState] = useState(() => ({
    owner: lifecycleKey,
    loading: false,
    open: false,
  }))
  const currentLifecycleKeyRef = useRef(lifecycleKey)
  const mountedRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<{
    owner: string
    sequence: number
    controller: AbortController
  } | null>(null)
  const onSuccessRef = useRef(onSuccess)

  currentLifecycleKeyRef.current = lifecycleKey
  onSuccessRef.current = onSuccess

  const loading = dialogState.owner === lifecycleKey && dialogState.loading
  const open = dialogState.owner === lifecycleKey && dialogState.open
  const setOpen = (nextOpen: boolean) => {
    setDialogState((current) => ({
      owner: lifecycleKey,
      loading: current.owner === lifecycleKey ? current.loading : false,
      open: nextOpen,
    }))
  }

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      activeRequestRef.current?.controller.abort()
      activeRequestRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      const activeRequest = activeRequestRef.current
      if (activeRequest?.owner === lifecycleKey) {
        activeRequest.controller.abort()
        activeRequestRef.current = null
      }
    }
  }, [lifecycleKey])

  const handleOutcomeUnconfirmed = (isCurrentRequest: () => boolean) => {
    if (!isCurrentRequest()) return

    toast.warning(t('outcomeUnconfirmed'))
    setDialogState({ owner: lifecycleKey, loading: true, open: false })
    onSuccessRef.current?.()
  }

  const handleReopen = async () => {
    const expectedLifecycleKey = lifecycleKey
    if (!expectedLifecycleKey) return

    activeRequestRef.current?.controller.abort()
    const controller = new AbortController()
    const sequence = ++requestSequenceRef.current
    activeRequestRef.current = {
      owner: expectedLifecycleKey,
      sequence,
      controller,
    }
    const isCurrentRequest = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      currentLifecycleKeyRef.current === expectedLifecycleKey &&
      activeRequestRef.current?.owner === expectedLifecycleKey &&
      activeRequestRef.current.sequence === sequence

    setDialogState({ owner: expectedLifecycleKey, loading: true, open: true })
    try {
      let res: Response
      try {
        res = await fetch(`/api/tickets/${ticketId}/reopen`, {
          method: 'PUT',
          headers: user?.id
            ? { 'X-CSP-Expected-User-Id': user.id }
            : undefined,
          signal: controller.signal,
        })
      } catch (error) {
        if (!isCurrentRequest()) return

        console.error('Failed to reopen ticket:', error)
        handleOutcomeUnconfirmed(isCurrentRequest)
        return
      }

      if (!isCurrentRequest()) return

      let data: {
        success?: boolean
        data?: {
          auditNote?: 'created' | 'rejected' | 'unconfirmed'
        }
        error?: {
          code?: string
          message?: string
        }
      }

      try {
        const parsed = await res.json() as unknown
        if (!isCurrentRequest()) return
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Reopen response body was empty')
        }
        data = parsed as typeof data
      } catch (error) {
        if (!isCurrentRequest()) return

        console.error('Failed to parse reopen response:', error)
        if (res.ok || res.status >= 500) {
          handleOutcomeUnconfirmed(isCurrentRequest)
        } else {
          toast.error(t('error'))
        }
        return
      }

      if (res.ok && data.success) {
        if (!isCurrentRequest()) return

        if (data.data?.auditNote === 'rejected' || data.data?.auditNote === 'unconfirmed') {
          toast.warning(t('partialSuccess'))
        } else {
          toast.success(t('success'))
        }
        setDialogState({ owner: expectedLifecycleKey, loading: true, open: false })
        onSuccessRef.current?.()
      } else if (
        res.status >= 500 &&
        data.error?.code === 'OUTCOME_UNCONFIRMED'
      ) {
        if (!isCurrentRequest()) return

        toast.warning(t('outcomeUnconfirmed'))
        setDialogState({ owner: expectedLifecycleKey, loading: true, open: false })
        onSuccessRef.current?.()
      } else {
        if (!isCurrentRequest()) return
        toast.error(data.error?.message || t('error'))
      }
    } finally {
      if (isCurrentRequest()) {
        activeRequestRef.current = null
        setDialogState((current) => current.owner === expectedLifecycleKey
          ? { ...current, loading: false }
          : current)
      }
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!lifecycleKey || loading}>
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
