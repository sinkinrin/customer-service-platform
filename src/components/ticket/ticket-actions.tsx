'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, X } from 'lucide-react'
import type { ZammadTicket } from '@/lib/stores/ticket-store'

interface TicketActionsProps {
  ticket: ZammadTicket
  onUpdate: (updates: {
    state?: string
    priority?: string
    owner_id?: number
  }) => Promise<void>
  onAddNote: (note: string, internal: boolean) => Promise<void>
  isLoading?: boolean
}

const STATES = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'pending reminder', label: 'Pending Reminder' },
  { value: 'pending close', label: 'Pending Close' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITIES = [
  { value: '1 low', label: 'Low' },
  { value: '2 normal', label: 'Normal' },
  { value: '3 high', label: 'High' },
]

export function TicketActions({
  ticket,
  onUpdate,
  onAddNote,
  isLoading,
}: TicketActionsProps) {
  const [state, setState] = useState(ticket.state)
  const [priority, setPriority] = useState(ticket.priority)
  const [note, setNote] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleStateChange = (value: string) => {
    setState(value)
    setHasChanges(true)
  }

  const handlePriorityChange = (value: string) => {
    setPriority(value)
    setHasChanges(true)
  }

  const handleSave = async () => {
    const updates: { state?: string; priority?: string } = {}
    
    if (state !== ticket.state) {
      updates.state = state
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
    setHasChanges(false)
  }

  const handleAddNote = async () => {
    if (note.trim()) {
      await onAddNote(note, isInternal)
      setNote('')
      setIsInternal(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status and Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select value={state} onValueChange={handleStateChange}>
              <SelectTrigger id="state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={handlePriorityChange}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
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
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note */}
      <Card>
        <CardHeader>
          <CardTitle>Add Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note Content</Label>
            <Textarea
              id="note"
              placeholder="Add a note or reply to this ticket..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
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
              Internal note (not visible to customer)
            </Label>
          </div>

          <Button
            onClick={handleAddNote}
            disabled={!note.trim() || isLoading}
            className="w-full"
          >
            Add Note
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

