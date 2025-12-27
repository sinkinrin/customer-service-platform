'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Save, X, Clock, Upload } from 'lucide-react'
import type { ZammadTicket } from '@/lib/stores/ticket-store'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface TicketActionsProps {
  ticket: ZammadTicket
  onUpdate: (updates: {
    state?: string
    priority?: string
    owner_id?: number
    pending_time?: string
  }) => Promise<void>
  onAddNote: (note: string, internal: boolean, attachments?: Array<{filename: string; data: string; 'mime-type': string}>) => Promise<void>
  isLoading?: boolean
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
}: TicketActionsProps) {
  const t = useTranslations('tickets.details')
  const tCommon = useTranslations('common')
  const [state, setState] = useState(ticket.state)
  const [priority, setPriority] = useState(ticket.priority)
  const [pendingTime, setPendingTime] = useState('')
  const [note, setNote] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showPendingTime, setShowPendingTime] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1]
        resolve(base64String)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (files.length + selectedFiles.length > 5) {
      toast.error('Maximum 5 files allowed')
      return
    }

    const invalidFiles = selectedFiles.filter(file => file.size > 10 * 1024 * 1024)
    if (invalidFiles.length > 0) {
      toast.error('File size must be less than 10MB')
      return
    }

    setFiles([...files, ...selectedFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
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
      // Convert files to base64 attachments
      let attachments: { filename: string; data: string; 'mime-type': string }[] = []
      if (files.length > 0) {
        try {
          attachments = await Promise.all(
            files.map(async (file) => ({
              filename: file.name,
              data: await fileToBase64(file),
              'mime-type': file.type || 'application/octet-stream',
            }))
          )
        } catch (error) {
          toast.error('Failed to process attachments')
          return
        }
      }

      await onAddNote(note, isInternal, attachments.length > 0 ? attachments : undefined)
      setNote('')
      setIsInternal(false)
      setFiles([])
    }
  }

  return (
    <div className="space-y-6">
      {/* Status and Priority */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ticketStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="state">{t('state')}</Label>
            <Select value={state} onValueChange={handleStateChange}>
              <SelectTrigger id="state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATE_KEYS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(`states.${s.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pending Time Picker - Only show for pending states */}
          {showPendingTime && (
            <div className="space-y-2">
              <Label htmlFor="pending-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('pendingUntil')}
              </Label>
              <Input
                id="pending-time"
                type="datetime-local"
                value={pendingTime}
                onChange={(e) => handlePendingTimeChange(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full"
                required
              />
              <p className="text-sm text-muted-foreground">
                {t('pendingReminder')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">{t('priority')}</Label>
            <Select value={priority} onValueChange={handlePriorityChange}>
              <SelectTrigger id="priority">
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

          {hasChanges && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {t('saveChanges')}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                {tCommon('cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note */}
      <Card>
        <CardHeader>
          <CardTitle>{t('addNote')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">{t('noteContent')}</Label>
            <Textarea
              id="note"
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>

          {/* File Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                id="note-files"
                type="file"
                onChange={handleFileChange}
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('note-files')?.click()}
                disabled={files.length >= 5}
              >
                <Upload className="mr-2 h-4 w-4" />
                Attach Files
              </Button>
              <span className="text-xs text-muted-foreground">
                Max 5 files • 10MB each
              </span>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Upload className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="internal"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="internal" className="cursor-pointer">
              {t('internalNoteCheckbox')}
            </Label>
          </div>

          <Button
            onClick={handleAddNote}
            disabled={!note.trim() || isLoading}
            className="w-full"
          >
            {t('addNote')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

