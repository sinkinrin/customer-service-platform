/**
 * Ticket Assignment Dialog
 * 
 * Dialog for admin to assign tickets to staff members
 */

"use client"

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    UserCheck,
    Loader2,
    AlertCircle,
    Ticket,
    Plane,
    CheckCircle
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface StaffMember {
    id: number
    name: string
    email: string
    is_available: boolean
    is_on_vacation: boolean
    vacation_end_date: string | null
    ticket_count: number
}

interface TicketInfo {
    id: number
    number: string
    title: string
    owner_id?: number | null
}

interface TicketAssignDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ticket: TicketInfo | null
    onSuccess?: () => void | Promise<void>
}

export function TicketAssignDialog({
    open,
    onOpenChange,
    ticket,
    onSuccess
}: TicketAssignDialogProps) {
    const t = useTranslations('admin.ticketAssign')
    const tCommon = useTranslations('common')

    const [loading, setLoading] = useState(false)
    const [assigning, setAssigning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)

    // Fetch available staff when dialog opens
    useEffect(() => {
        if (open && ticket) {
            fetchStaff()
            // owner_id=1 is Zammad system user, treat as unassigned (null)
            const ownerId = ticket.owner_id === 1 ? null : ticket.owner_id
            setSelectedStaffId(ownerId || null)
        }
    }, [open, ticket])

    const fetchStaff = async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/staff/available')
            if (res.ok) {
                const data = await res.json()
                // API returns { success: true, data: { staff: [...] } }
                setStaffList(data.data?.staff || data.staff || [])
            } else {
                setError('Failed to load staff list')
            }
        } catch (err) {
            console.error('Failed to fetch staff:', err)
            setError('Failed to load staff list')
        } finally {
            setLoading(false)
        }
    }

    const handleAssign = async () => {
        if (!ticket || !selectedStaffId) return

        setAssigning(true)
        setError(null)

        // Optimistically update UI: decrease previous owner's count, increase new owner's count
        const previousOwnerId = ticket.owner_id
        const optimisticStaffList = staffList.map(staff => {
            if (staff.id === previousOwnerId && previousOwnerId) {
                return { ...staff, ticket_count: Math.max(0, staff.ticket_count - 1) }
            }
            if (staff.id === selectedStaffId) {
                return { ...staff, ticket_count: staff.ticket_count + 1 }
            }
            return staff
        })
        setStaffList(optimisticStaffList)

        try {
            const res = await fetch(`/api/tickets/${ticket.id}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: selectedStaffId }),
            })

            const result = await res.json()
            if (res.ok && result.success) {
                const assignedTo = result.data?.assigned_to
                toast.success(t('assignSuccess', { name: assignedTo?.name || 'Staff' }))

                // Refresh staff list after successful assignment to ensure accuracy
                await fetchStaff()

                // Call onSuccess callback to refresh parent component (wait for completion)
                await onSuccess?.()
                onOpenChange(false)
            } else {
                // Revert optimistic update on error
                setStaffList(staffList)
                setError(result.error?.message || 'Failed to assign ticket')
            }
        } catch (err) {
            console.error('Failed to assign ticket:', err)
            // Revert optimistic update on error
            setStaffList(staffList)
            setError('Failed to assign ticket')
        } finally {
            setAssigning(false)
        }
    }

    const handleUnassign = async () => {
        if (!ticket) return

        setAssigning(true)
        setError(null)

        // Optimistically update UI: decrease previous owner's count
        const previousOwnerId = ticket.owner_id
        if (previousOwnerId) {
            const optimisticStaffList = staffList.map(staff => {
                if (staff.id === previousOwnerId) {
                    return { ...staff, ticket_count: Math.max(0, staff.ticket_count - 1) }
                }
                return staff
            })
            setStaffList(optimisticStaffList)
        }

        try {
            const res = await fetch(`/api/tickets/${ticket.id}/assign`, {
                method: 'DELETE',
            })

            const result = await res.json()
            if (res.ok && result.success) {
                toast.success(t('unassignSuccess'))

                // Refresh staff list after successful unassignment
                await fetchStaff()

                // Call onSuccess callback to refresh parent component (wait for completion)
                await onSuccess?.()
                onOpenChange(false)
            } else {
                // Revert optimistic update on error
                setStaffList(staffList)
                setError(result.error?.message || 'Failed to unassign ticket')
            }
        } catch (err) {
            console.error('Failed to unassign ticket:', err)
            // Revert optimistic update on error
            setStaffList(staffList)
            setError('Failed to unassign ticket')
        } finally {
            setAssigning(false)
        }
    }

    const getLoadBadgeVariant = (count: number): "default" | "secondary" | "destructive" => {
        if (count === 0) return "secondary"
        if (count <= 5) return "default"
        return "destructive"
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        {t('title')}
                    </DialogTitle>
                    {ticket && (
                        <DialogDescription>
                            {t('description', { number: ticket.number, title: ticket.title })}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-2">
                                {(staffList || []).map((staff) => (
                                    <button
                                        key={staff.id}
                                        onClick={() => setSelectedStaffId(staff.id)}
                                        disabled={assigning}
                                        className={cn(
                                            "w-full p-3 rounded-lg border text-left transition-all",
                                            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
                                            selectedStaffId === staff.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border",
                                            staff.is_on_vacation && "opacity-60"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {selectedStaffId === staff.id && (
                                                    <CheckCircle className="h-5 w-5 text-primary" />
                                                )}
                                                <div>
                                                    <p className="font-medium">{staff.name}</p>
                                                    <p className="text-sm text-muted-foreground">{staff.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {staff.is_on_vacation && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                                                        <Plane className="h-3 w-3 mr-1" />
                                                        {t('onVacation')}
                                                    </Badge>
                                                )}
                                                <Badge variant={getLoadBadgeVariant(staff.ticket_count)}>
                                                    <Ticket className="h-3 w-3 mr-1" />
                                                    {staff.ticket_count}
                                                </Badge>
                                            </div>
                                        </div>
                                        {staff.is_on_vacation && staff.vacation_end_date && (
                                            <p className="text-xs text-muted-foreground mt-1 ml-8">
                                                {t('vacationUntil', { date: staff.vacation_end_date })}
                                            </p>
                                        )}
                                    </button>
                                ))}

                                {staffList.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        {t('noStaffAvailable')}
                                    </p>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="flex gap-2 pt-4 border-t">
                            {ticket?.owner_id && (
                                <Button
                                    variant="outline"
                                    onClick={handleUnassign}
                                    disabled={assigning}
                                    className="flex-1"
                                >
                                    {assigning ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    {t('unassign')}
                                </Button>
                            )}
                            <Button
                                onClick={handleAssign}
                                disabled={assigning || !selectedStaffId || selectedStaffId === ticket?.owner_id}
                                className="flex-1"
                            >
                                {assigning ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        {tCommon('saving')}
                                    </>
                                ) : (
                                    t('assign')
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
