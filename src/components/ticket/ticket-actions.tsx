'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Save, X, Clock, Upload, Loader2, CheckCircle } from 'lucide-react'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ATTACHMENT_LIMITS, FILE_ACCEPT, formatFileSize } from '@/lib/constants/attachments'
import { useFileUpload } from '@/lib/hooks/use-file-upload'

interface TicketActionsProps {
  ticket: ZammadTicket
  onUpdate: (updates: {
    state?: string
    priority?: string
    owner_id?: number
    pending_time?: string
  }) => Promise<void>
  onAddNote: (note: string, internal: boolean, attachmentIds?: number[], replyType?: 'note' | 'email', formId?: string) => Promise<void>
  isLoading?: boolean
  customerEmail?: string  // Customer email for sending email replies
  compact?: boolean
  /** Expose a setter so external components (e.g. AI panel) can insert text into the reply textarea */
  onNoteRef?: (setter: (text: string) => void) => void
}

const STATE_KEYS = [
  { value: 'new', labelKey: 'new' },
  { value: 'open', labelKey: 'open' },
  { value: 'pending reminder', labelKey: 'pendingReminder' },
  { value: 'pending close', labelKey: 'pendingClose' },
  { value: 'closed', labelKey: 'closed' },
]

const PRIORITY_KEYS = [
  { value: '1 low', labelKey: 'low' },
  { value: '2 normal', labelKey: 'normal' },
  { value: '3 high', labelKey: 'high' },
]

export function TicketActions({
  ticket,
  onUpdate,
  onAddNote,
  isLoading,
  compact = false,
  onNoteRef,
}: TicketActionsProps) {
  const t = useTranslations('tickets.details')
  const tCommon = useTranslations('common')
  const [state, setState] = useState(ticket.state)
  const [priority, setPriority] = useState(ticket.priority)
  const [pendingTime, setPendingTime] = useState('')
  const [note, setNote] = useState('')
  const [replyMode, setReplyMode] = useState<'web' | 'email' | 'note'>('web')
  const [hasChanges, setHasChanges] = useState(false)
  const [showPendingTime, setShowPendingTime] = useState(false)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Use shared file upload hook
  const {
    uploadedFiles,
    isUploading,
    addFiles,
    removeFile: handleRemoveFile,
    clearFiles,
    getAttachmentIds,
    getFormId,
  } = useFileUpload({
    onError: (msg) => toast.error(msg),
  })

  // Auto-resize textarea based on content
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value)
    if (noteTextareaRef.current) {
      const maxHeight = compact ? 300 : 700
      noteTextareaRef.current.style.height = 'auto'
      noteTextareaRef.current.style.height = `${Math.min(noteTextareaRef.current.scrollHeight, maxHeight)}px`
    }
  }

  // Expose note setter for external AI insert
  useEffect(() => {
    if (onNoteRef) {
      onNoteRef((text: string) => {
        setNote(text)
        // Trigger auto-resize after setting text
        setTimeout(() => {
          if (noteTextareaRef.current) {
            const maxHeight = compact ? 300 : 700
            noteTextareaRef.current.style.height = 'auto'
            noteTextareaRef.current.style.height = `${Math.min(noteTextareaRef.current.scrollHeight, maxHeight)}px`
          }
        }, 0)
      })
    }
  }, [onNoteRef, compact])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await addFiles(e.target.files)
    }
    // Reset input
    e.target.value = ''
  }

  // Check if current state requires pending time
  useEffect(() => {
    const stateLower = state.toLowerCase()
    const requiresPendingTime = stateLower === 'pending reminder' || stateLower === 'pending close'
    setShowPendingTime(requiresPendingTime)

    // Set default pending time to 24 hours from now if not already set
    if (requiresPendingTime && !pendingTime) {
      const defaultTime = new Date()
      defaultTime.setHours(defaultTime.getHours() + 24)
      // Format as datetime-local input value (YYYY-MM-DDTHH:mm)
      const formatted = defaultTime.toISOString().slice(0, 16)
      setPendingTime(formatted)
    }
  }, [state, pendingTime])

  const handleStateChange = (value: string) => {
    setState(value)
    setHasChanges(true)
  }

  const handlePriorityChange = (value: string) => {
    setPriority(value)
    setHasChanges(true)
  }

  const handlePendingTimeChange = (value: string) => {
    setPendingTime(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    const updates: { state?: string; priority?: string; pending_time?: string } = {}

    if (state !== ticket.state) {
      updates.state = state

      // Add pending_time if state requires it
      const stateLower = state.toLowerCase()
      if (stateLower === 'pending reminder' || stateLower === 'pending close') {
        if (!pendingTime) {
          alert(t('selectPendingTime'))
          return
        }
        // Convert to ISO 8601 format
        updates.pending_time = new Date(pendingTime).toISOString()
      }
    }
    if (priority !== ticket.priority) {
      updates.priority = priority
    }

    if (Object.keys(updates).length > 0) {
      await onUpdate(updates)
      setHasChanges(false)
    }
  }

  const handleCancel = () => {
    setState(ticket.state)
    setPriority(ticket.priority)
    setPendingTime('')
    setHasChanges(false)
  }

  const handleAddNote = async () => {
    if (note.trim()) {
      // Get attachment IDs and form_id from successfully uploaded files
      const attachmentIds = getAttachmentIds()
      const formId = getFormId()

      // internal is true only for 'note' mode
      // email type is handled by passing 'email' as the last argument
      const isNoteInternal = replyMode === 'note'
      const typeForApi = replyMode === 'email' ? 'email' : 'note'

      await onAddNote(
        note,
        isNoteInternal,
        attachmentIds.length > 0 ? attachmentIds : undefined,
        typeForApi,
        formId || undefined
      )
      setNote('')
      setReplyMode('web')
      clearFiles()
      // Reset textarea height after clearing
      if (noteTextareaRef.current) {
        noteTextareaRef.current.style.height = 'auto'
      }
    }
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {/* Status and Priority - Dense Row */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs font-semibold text-muted-foreground">{t('state')}</Label>
              <Select value={state} onValueChange={handleStateChange}>
                <SelectTrigger id="state" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <TooltipProvider delayDuration={300}>
                    {STATE_KEYS.map((s) => (
                      <Tooltip key={s.value}>
                        <TooltipTrigger asChild>
                          <SelectItem value={s.value}>
                            {t(`states.${s.labelKey}`)}
                          </SelectItem>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p className="text-xs">{t(`stateDescriptions.${s.labelKey}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority" className="text-xs font-semibold text-muted-foreground">{t('priority')}</Label>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger id="priority" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_KEYS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(`priorities.${p.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pending Time Picker */}
          {showPendingTime && (
            <div className="space-y-1.5 mt-3 pt-3 border-t">
              <Label
                htmlFor="pending-time"
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
              >
                <Clock className="h-3 w-3" />
                {t('pendingUntil')}
              </Label>
              <Input
                id="pending-time"
                type="datetime-local"
                value={pendingTime}
                onChange={(e) => handlePendingTimeChange(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="h-8 text-sm"
                required
              />
            </div>
          )}

          {hasChanges && (
            <div className="flex gap-2 pt-3 mt-1">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 h-8"
                size="sm"
              >
                <Save className="h-3.5 w-3.5 mr-2" />
                {t('saveChanges')}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                size="sm"
                className="h-8"
              >
                <X className="h-3.5 w-3.5 mr-2" />
                {tCommon('cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Reply - Dense */}
      <Card className="flex flex-col min-h-0 flex-1">
        <CardContent className="p-3 space-y-3 flex flex-col min-h-0 flex-1">
          {/* Reply Mode Selection */}
          <div className="space-y-2">
            <div className="flex bg-muted/50 p-1 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => setReplyMode('web')}
                className={cn(
                  "flex-1 text-xs py-1.5 px-2 rounded-md transition-all text-center font-medium",
                  replyMode === 'web'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('replyTypeWeb')}
              </button>
              <button
                type="button"
                onClick={() => setReplyMode('email')}
                className={cn(
                  "flex-1 text-xs py-1.5 px-2 rounded-md transition-all text-center font-medium",
                  replyMode === 'email'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('replyTypeEmail')}
              </button>
              <button
                type="button"
                onClick={() => setReplyMode('note')}
                className={cn(
                  "flex-1 text-xs py-1.5 px-2 rounded-md transition-all text-center font-medium",
                  replyMode === 'note'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('replyTypeNote')}
              </button>
            </div>
            {replyMode === 'email' && (
              <p className="text-xs text-muted-foreground px-1">
                {t('emailWillBeSent')}
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
            <Textarea
              id="note"
              ref={noteTextareaRef}
              placeholder={replyMode === 'email' ? (t('emailPlaceholder') || 'Type your email reply...') : t('notePlaceholder')}
              value={note}
              onChange={handleNoteChange}
              className={cn(
                'resize-none h-full min-h-[150px] p-3 text-sm',
                // Dynamic height constraints
                'max-h-[600px]'
              )}
            />
          </div>

          {/* Footer Actions: File & Submit */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Input
                  id="note-files"
                  type="file"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  accept={FILE_ACCEPT}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => document.getElementById('note-files')?.click()}
                  disabled={uploadedFiles.length >= ATTACHMENT_LIMITS.MAX_COUNT}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  <span className="text-xs">{t('attachFiles')}</span>
                </Button>
              </div>

              <Button
                onClick={handleAddNote}
                disabled={!note.trim() || isLoading || isUploading}
                variant="default"
                size="sm"
                className="px-6 h-8"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {tCommon('uploading')}
                  </>
                ) : (
                  tCommon('submit')
                )}
              </Button>
            </div>

            {/* File List - Inline Compact with Status */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1 bg-muted/30 rounded-md p-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{t('attachFiles')}: {uploadedFiles.length}</p>
                {uploadedFiles.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between py-1 px-2 rounded border transition-colors group ${
                      uploadedFile.error ? 'bg-red-50 border-red-200' :
                      uploadedFile.uploading ? 'bg-yellow-50 border-yellow-200' :
                      'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {uploadedFile.uploading ? (
                        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-yellow-600" />
                      ) : uploadedFile.error ? (
                        <X className="h-3 w-3 flex-shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-600" />
                      )}
                      <span className="text-xs truncate max-w-[180px]">{uploadedFile.file.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        ({formatFileSize(uploadedFile.file.size)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
