'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REGIONS, type RegionValue } from '@/lib/constants/regions'

type ServiceBaseRegion =
  | 'AFRICA'
  | 'MIDDLE_EAST'
  | 'ASIA_PACIFIC'
  | 'NORTH_AMERICA'
  | 'LATIN_AMERICA'
  | 'EUROPE_ZONE_1'
  | 'EUROPE_ZONE_2'
  | 'CIS'

interface ServiceGroup {
  id: number
  name: string
  baseRegion: ServiceBaseRegion
  staffZammadId: number
  isActive: boolean
  updatedAt: string
}

interface StaffOption {
  id: number
  name: string
  email?: string
  is_available: boolean
  is_on_vacation: boolean
  ticket_count: number
}

interface ServiceGroupForm {
  name: string
  baseRegion: RegionValue
  staffZammadId: string
}

const REGION_TO_BASE_REGION: Record<RegionValue, ServiceBaseRegion> = {
  'africa': 'AFRICA',
  'middle-east': 'MIDDLE_EAST',
  'asia-pacific': 'ASIA_PACIFIC',
  'north-america': 'NORTH_AMERICA',
  'latin-america': 'LATIN_AMERICA',
  'europe-zone-1': 'EUROPE_ZONE_1',
  'europe-zone-2': 'EUROPE_ZONE_2',
  'cis': 'CIS',
}

const BASE_REGION_TO_REGION: Record<ServiceBaseRegion, RegionValue> = {
  AFRICA: 'africa',
  MIDDLE_EAST: 'middle-east',
  ASIA_PACIFIC: 'asia-pacific',
  NORTH_AMERICA: 'north-america',
  LATIN_AMERICA: 'latin-america',
  EUROPE_ZONE_1: 'europe-zone-1',
  EUROPE_ZONE_2: 'europe-zone-2',
  CIS: 'cis',
}

const DEFAULT_FORM: ServiceGroupForm = {
  name: '',
  baseRegion: REGIONS[0].value,
  staffZammadId: '',
}

export default function AdminServiceGroupsPage() {
  const t = useTranslations('admin.serviceGroups')
  const tToast = useTranslations('toast.admin.serviceGroups')
  const tCommon = useTranslations('common')
  const tRegions = useTranslations('common.regions')

  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([])
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ServiceGroup | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deactivatingGroup, setDeactivatingGroup] = useState<ServiceGroup | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [form, setForm] = useState<ServiceGroupForm>(DEFAULT_FORM)

  const transferTargets = useMemo(
    () => serviceGroups.filter((group) => group.isActive && group.id !== deactivatingGroup?.id),
    [deactivatingGroup?.id, serviceGroups]
  )

  const staffMap = useMemo(
    () => new Map(staffOptions.map((staff) => [staff.id, staff])),
    [staffOptions]
  )

  const fetchServiceGroups = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch('/api/admin/service-groups')
      if (!response.ok) {
        throw new Error('Failed to load service groups')
      }

      const result = await response.json()
      if (result.success && result.data?.serviceGroups) {
        setServiceGroups(result.data.serviceGroups)
      }
    } catch (error) {
      toast.error(tToast('loadError'))
      console.error(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchStaffOptions = async () => {
    setLoadingStaff(true)
    try {
      const response = await fetch('/api/staff/available')
      if (!response.ok) {
        throw new Error('Failed to load staff options')
      }

      const result = await response.json()
      setStaffOptions(result.data?.staff || [])
    } catch (error) {
      toast.error(tToast('staffLoadError'))
      console.error(error)
    } finally {
      setLoadingStaff(false)
    }
  }

  useEffect(() => {
    fetchServiceGroups()
    fetchStaffOptions()
  }, [])

  const getRegionLabel = (baseRegion: ServiceBaseRegion) => {
    return tRegions(BASE_REGION_TO_REGION[baseRegion])
  }

  const resetForm = () => {
    setForm(DEFAULT_FORM)
    setEditingGroup(null)
  }

  const openCreateDialog = () => {
    resetForm()
    if (staffOptions.length === 1) {
      setForm((current) => ({ ...current, staffZammadId: String(staffOptions[0].id) }))
    }
    setDialogOpen(true)
  }

  const openEditDialog = (group: ServiceGroup) => {
    setEditingGroup(group)
    setForm({
      name: group.name,
      baseRegion: BASE_REGION_TO_REGION[group.baseRegion],
      staffZammadId: String(group.staffZammadId),
    })
    setDialogOpen(true)
  }

  const openDeactivateDialog = (group: ServiceGroup) => {
    const availableTargets = serviceGroups.filter((item) => item.isActive && item.id !== group.id)
    setDeactivatingGroup(group)
    setTransferTargetId(availableTargets[0] ? String(availableTargets[0].id) : '')
    setDeactivateDialogOpen(true)
  }

  const getOwnerLabel = (staffZammadId: number) => {
    const owner = staffMap.get(staffZammadId)
    if (!owner) {
      return String(staffZammadId)
    }

    return owner.email ? `${owner.name} (${owner.email})` : owner.name
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.staffZammadId.trim()) {
      toast.error(tToast('validationError'))
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        editingGroup ? `/api/admin/service-groups/${editingGroup.id}` : '/api/admin/service-groups',
        {
          method: editingGroup ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            baseRegion: REGION_TO_BASE_REGION[form.baseRegion],
            staffZammadId: Number(form.staffZammadId),
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save service group')
      }

      toast.success(editingGroup ? tToast('updateSuccess') : tToast('createSuccess'))
      setDialogOpen(false)
      resetForm()
      await fetchServiceGroups()
    } catch (error) {
      toast.error(editingGroup ? tToast('updateError') : tToast('createError'))
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivatingGroup || !transferTargetId) {
      toast.error(tToast('transferRequired'))
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/service-groups/${deactivatingGroup.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferToServiceGroupId: Number(transferTargetId) }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to deactivate service group')
      }

      toast.success(tToast('deactivateSuccess'))
      setDeactivateDialogOpen(false)
      setDeactivatingGroup(null)
      setTransferTargetId('')
      await fetchServiceGroups()
    } catch (error) {
      toast.error(tToast('deactivateError'))
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await Promise.all([fetchServiceGroups(true), fetchStaffOptions()])
            }}
            disabled={refreshing || loading || loadingStaff}
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t('refreshButton')}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createButton')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.name')}</TableHead>
                  <TableHead>{t('table.baseRegion')}</TableHead>
                  <TableHead>{t('table.owner')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.updatedAt')}</TableHead>
                  <TableHead>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map((item) => (
                  <TableRow key={`service-group-skeleton-${item}`}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : serviceGroups.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{t('empty')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.name')}</TableHead>
                  <TableHead>{t('table.baseRegion')}</TableHead>
                  <TableHead>{t('table.owner')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.updatedAt')}</TableHead>
                  <TableHead>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{getRegionLabel(group.baseRegion)}</TableCell>
                    <TableCell>{getOwnerLabel(group.staffZammadId)}</TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(group.updatedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(group)}>
                          {tCommon('edit')}
                        </Button>
                        {group.isActive && (
                          <Button variant="outline" size="sm" onClick={() => openDeactivateDialog(group)}>
                            {t('deactivateButton')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
            <DialogDescription>
              {editingGroup ? t('dialog.editDescription') : t('dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-group-name">{t('form.name')}</Label>
              <Input
                id="service-group-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('form.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-group-base-region">{t('form.baseRegion')}</Label>
              <Select
                value={form.baseRegion}
                onValueChange={(value) => setForm((current) => ({ ...current, baseRegion: value as RegionValue }))}
              >
                <SelectTrigger id="service-group-base-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {tRegions(region.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-group-staff-id">{t('form.staff')}</Label>
              <Select
                value={form.staffZammadId}
                onValueChange={(value) => setForm((current) => ({ ...current, staffZammadId: value }))}
              >
                <SelectTrigger id="service-group-staff-id">
                  <SelectValue placeholder={loadingStaff ? tCommon('loading') : t('form.staffPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={String(staff.id)}>
                      {staff.email ? `${staff.name} (${staff.email})` : staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {staffOptions.length === 0 && !loadingStaff && (
                <p className="text-sm text-muted-foreground">{t('form.noStaff')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                resetForm()
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={submitting || loadingStaff || staffOptions.length === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? tCommon('save') : t('dialog.createConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deactivateDialogOpen}
        onOpenChange={(open) => {
          setDeactivateDialogOpen(open)
          if (!open) {
            setDeactivatingGroup(null)
            setTransferTargetId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.deactivateTitle')}</DialogTitle>
            <DialogDescription>
              {deactivatingGroup
                ? t('dialog.deactivateDescription', { name: deactivatingGroup.name })
                : t('dialog.deactivateDescription', { name: '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="service-group-transfer-target">{t('form.transferTarget')}</Label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger id="service-group-transfer-target">
                <SelectValue placeholder={t('form.transferTargetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {transferTargets.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {transferTargets.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('dialog.noTransferTargets')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleDeactivate} disabled={submitting || transferTargets.length === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('deactivateButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
