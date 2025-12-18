/**
 * Vacation Settings Dialog
 * 
 * Dialog for staff to set their vacation/out-of-office period
 */

"use client"

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar, Plane, User, Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface VacationStatus {
    is_on_vacation: boolean
    start_date: string | null
    end_date: string | null
    replacement: {
        id: number
        name: string
        email: string
    } | null
}

interface StaffMember {
    id: number
    name: string
    email: string
    is_available: boolean
}

interface VacationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function VacationDialog({ open, onOpenChange, onSuccess }: VacationDialogProps) {
    const t = useTranslations('staff.vacation')
    const tCommon = useTranslations('common')

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [vacationStatus, setVacationStatus] = useState<VacationStatus | null>(null)
    const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [replacementId, setReplacementId] = useState<string>('')

    // Fetch current vacation status and available staff
    useEffect(() => {
        if (open) {
            fetchData()
        }
    }, [open])

    const fetchData = async () => {
        setLoading(true)
        setError(null)

        try {
            // Fetch vacation status
            const vacationRes = await fetch('/api/staff/vacation')
            if (vacationRes.ok) {
                const res = await vacationRes.json()
                const vacation = res.data?.vacation
                if (vacation) {
                    setVacationStatus(vacation)
                    if (vacation.start_date) {
                        setStartDate(vacation.start_date)
                    }
                    if (vacation.end_date) {
                        setEndDate(vacation.end_date)
                    }
                    if (vacation.replacement?.id) {
                        setReplacementId(vacation.replacement.id.toString())
                    }
                }
            }

            // Fetch available staff for replacement selection
            const staffRes = await fetch('/api/staff/available')
            if (staffRes.ok) {
                const res = await staffRes.json()
                const staffList = res.data?.staff
                if (staffList && Array.isArray(staffList)) {
                    setAvailableStaff(staffList.filter((s: StaffMember) => s.is_available))
                }
            }
        } catch (err) {
            console.error('Failed to fetch vacation data:', err)
            setError('Failed to load vacation data')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates')
            return
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('End date must be after start date')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const res = await fetch('/api/staff/vacation', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    replacement_id: replacementId && replacementId !== 'none' ? parseInt(replacementId, 10) : null,
                }),
            })

            if (res.ok) {
                toast.success(t('setSuccess'))
                onSuccess?.()
                onOpenChange(false)
            } else {
                const result = await res.json()
                setError(result.error?.message || 'Failed to set vacation')
            }
        } catch (err) {
            console.error('Failed to set vacation:', err)
            setError('Failed to set vacation')
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = async () => {
        setCancelling(true)
        setError(null)

        try {
            const res = await fetch('/api/staff/vacation', {
                method: 'DELETE',
            })

            if (res.ok) {
                toast.success(t('cancelSuccess'))
                setVacationStatus(null)
                setStartDate('')
                setEndDate('')
                setReplacementId('')
                onSuccess?.()
                onOpenChange(false)
            } else {
                const result = await res.json()
                setError(result.error?.message || 'Failed to cancel vacation')
            }
        } catch (err) {
            console.error('Failed to cancel vacation:', err)
            setError('Failed to cancel vacation')
        } finally {
            setCancelling(false)
        }
    }

    const today = new Date().toISOString().split('T')[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        {vacationStatus?.is_on_vacation && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-sm text-amber-900 dark:text-amber-100">
                                    {t('currentlyOnVacation', {
                                        start: vacationStatus.start_date ?? '',
                                        end: vacationStatus.end_date ?? '',
                                    })}
                                </p>
                                {vacationStatus.replacement && (
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        {t('replacement')}: {vacationStatus.replacement.name}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-date" className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {t('startDate')}
                                </Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    min={today}
                                    disabled={saving || cancelling}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="end-date" className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {t('endDate')}
                                </Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate || today}
                                    disabled={saving || cancelling}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="replacement" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {t('replacementAgent')}
                                </Label>
                                <Select
                                    value={replacementId}
                                    onValueChange={setReplacementId}
                                    disabled={saving || cancelling}
                                >
                                    <SelectTrigger id="replacement">
                                        <SelectValue placeholder={t('selectReplacement')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t('noReplacement')}</SelectItem>
                                        {availableStaff.map((staff) => (
                                            <SelectItem key={staff.id} value={staff.id.toString()}>
                                                {staff.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2 sm:gap-0">
                    {vacationStatus?.is_on_vacation && (
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={saving || cancelling}
                        >
                            {cancelling ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {tCommon('cancelling')}
                                </>
                            ) : (
                                t('cancelVacation')
                            )}
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={saving || cancelling || loading || !startDate || !endDate}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {tCommon('saving')}
                            </>
                        ) : vacationStatus?.is_on_vacation ? (
                            t('updateVacation')
                        ) : (
                            t('setVacation')
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
