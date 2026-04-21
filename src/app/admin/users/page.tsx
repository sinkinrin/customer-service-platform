'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Label } from '@/components/ui/label'
import { Search, Edit, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { REGIONS, isValidRegion } from '@/lib/constants/regions'
import { UserImportDialog } from '@/components/admin/user-import-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'

interface User {
  user_id: string
  email: string
  full_name: string
  firstname?: string
  lastname?: string
  role: 'customer' | 'staff' | 'admin'
  phone?: string
  language?: string
  region?: string
  active?: boolean
  zammad_id?: number
  created_at: string
  service_group?: {
    id: number
    name: string
  } | null
}

interface ServiceGroupOption {
  id: number
  name: string
}

export default function UsersPage() {
  const t = useTranslations('admin.users')
  const tToast = useTranslations('toast.admin.users')
  const tCommon = useTranslations('common')
  const tRegions = useTranslations('common.regions')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 })
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [statusChangeUser, setStatusChangeUser] = useState<User | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [serviceGroups, setServiceGroups] = useState<ServiceGroupOption[]>([])
  const [selectedServiceGroupId, setSelectedServiceGroupId] = useState('')
  const [loadingEditContext, setLoadingEditContext] = useState(false)

  const fetchUsers = async (options?: { limit?: number; offset?: number }) => {
    const limit = options?.limit ?? pagination.limit
    const offset = options?.offset ?? pagination.offset
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (search) params.append('search', search)
      if (roleFilter !== 'all') params.append('role', roleFilter)
      if (regionFilter !== 'all') params.append('region', regionFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error('Failed to fetch users')

      const result = await response.json()
      if (result.success && result.data) {
        setUsers(result.data.users || [])
        setPagination((current) => ({
          limit: result.data.pagination?.limit ?? current.limit,
          offset: result.data.pagination?.offset ?? current.offset,
          total: result.data.pagination?.total ?? current.total,
        }))
      }
    } catch (error) {
      toast.error(tToast('loadError'))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, regionFilter, statusFilter, pagination.offset, pagination.limit]) // Re-fetch when filters or page change

  const handleSearch = () => {
    setPagination((current) => ({ ...current, offset: 0 }))
    if (pagination.offset === 0) {
      fetchUsers({ offset: 0 })
    }
  }

  const loadCustomerEditContext = async (user: User) => {
    const userId = user.zammad_id || Number(user.user_id)
    if (!userId) return

    setLoadingEditContext(true)
    try {
      const [detailResponse, groupsResponse] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch('/api/admin/service-groups'),
      ])

      const detailData = await detailResponse.json().catch(() => ({}))
      const groupsData = await groupsResponse.json().catch(() => ({}))

      if (detailData.success && detailData.data?.user) {
        setEditingUser((current) => current ? {
          ...current,
          region: detailData.data.user.region,
          service_group: detailData.data.user.service_group,
        } : current)
        setSelectedServiceGroupId(
          detailData.data.user.service_group?.id ? String(detailData.data.user.service_group.id) : ''
        )
      }

      if (groupsData.success && groupsData.data?.serviceGroups) {
        setServiceGroups(
          groupsData.data.serviceGroups.map((group: ServiceGroupOption) => ({
            id: group.id,
            name: group.name,
          }))
        )
      }
    } catch (error) {
      toast.error(tToast('loadError'))
      console.error(error)
    } finally {
      setLoadingEditContext(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setSelectedServiceGroupId(user.service_group?.id ? String(user.service_group.id) : '')
    setServiceGroups([])
    setEditDialogOpen(true)

    if (user.role === 'customer') {
      void loadCustomerEditContext(user)
    }
  }

  const handleSave = async () => {
    if (!editingUser) return

    setSaving(true)
    try {
      const updateData: Record<string, unknown> = {
        role: editingUser.role,
        firstname: editingUser.firstname || '',
        lastname: editingUser.lastname || '',
        phone: editingUser.phone,
        language: editingUser.language,
      }
      // Customer region is no longer a direct admin business control.
      if (editingUser.region && editingUser.role !== 'customer') {
        updateData.region = editingUser.region
      }

      const userId = editingUser.zammad_id || editingUser.user_id

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to update user')
      }

      if (editingUser.role === 'customer' && selectedServiceGroupId) {
        const assignmentResponse = await fetch(`/api/admin/customers/${userId}/service-group`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceGroupId: Number(selectedServiceGroupId) }),
        })

        if (!assignmentResponse.ok) {
          const assignmentError = await assignmentResponse.json().catch(() => ({}))
          throw new Error(assignmentError.error || 'Failed to update service group')
        }
      }

      toast.success(tToast('updateSuccess'))
      setEditDialogOpen(false)
      fetchUsers()
    } catch (error) {
      toast.error(tToast('updateError'))
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'staff':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getRegionLabel = (regionValue?: string) => {
    if (!regionValue) return '-'
    if (isValidRegion(regionValue)) {
      return tRegions(regionValue)
    }
    return regionValue
  }

  const handleStatusToggle = (user: User) => {
    setStatusChangeUser(user)
    setStatusDialogOpen(true)
  }

  const confirmStatusChange = async () => {
    if (!statusChangeUser || !statusChangeUser.zammad_id) {
      toast.error(tToast('updateError'))
      setStatusDialogOpen(false)
      return
    }

    setChangingStatus(true)
    try {
      const response = await fetch(`/api/admin/users/${statusChangeUser.zammad_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !statusChangeUser.active }),
      })

      if (!response.ok) throw new Error('Failed to change status')

      toast.success(tToast('updateSuccess'))
      setStatusDialogOpen(false)
      fetchUsers()
    } catch (error) {
      toast.error(tToast('updateError'))
      console.error(error)
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('pageDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('searchDescription')}</CardDescription>
            </div>
            <Link href="/admin/users/create">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('createButton')}
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              {t('actions.importUsers')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('filterPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allRoles')}</SelectItem>
                <SelectItem value="customer">{t('roles.customer')}</SelectItem>
                <SelectItem value="staff">{t('roles.staff')}</SelectItem>
                <SelectItem value="admin">{t('roles.admin')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filters.allRegions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allRegions')}</SelectItem>
                {REGIONS.map(region => (
                  <SelectItem key={region.value} value={region.value}>
                    {tRegions(region.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="active">{t('statusOptions.active')}</SelectItem>
                <SelectItem value="disabled">{t('statusOptions.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.name')}</TableHead>
                    <TableHead>{t('table.email')}</TableHead>
                    <TableHead>{t('table.role')}</TableHead>
                    <TableHead>{t('table.phone')}</TableHead>
                    <TableHead>{t('table.createdAt')}</TableHead>
                    <TableHead>{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <TableRow key={`user-skeleton-${item}`}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            </>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('noUsers')}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.name')}</TableHead>
                    <TableHead>{t('table.email')}</TableHead>
                    <TableHead>{t('table.role')}</TableHead>
                    <TableHead>{t('table.region')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>{t('table.phone')}</TableHead>
                    <TableHead>{t('table.createdAt')}</TableHead>
                    <TableHead>{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.user_id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => handleEdit(user)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleEdit(user)
                        }
                      }}
                    >
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {t(`roles.${user.role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getRegionLabel(user.region)}</TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Switch
                            checked={user.active !== false}
                            onCheckedChange={() => handleStatusToggle(user)}
                            disabled={!user.zammad_id}
                          />
                          <Badge variant={user.active !== false ? 'default' : 'secondary'}>
                            {user.active !== false ? t('statusOptions.active') : t('statusOptions.inactive')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('editUser')}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEdit(user)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  {t('pagination.showing', {
                    start: pagination.offset + 1,
                    end: Math.min(pagination.offset + pagination.limit, pagination.total),
                    total: pagination.total
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((current) => ({
                      ...current,
                      offset: Math.max(0, current.offset - current.limit),
                    }))}
                    disabled={pagination.offset === 0}
                  >
                    {t('pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((current) => ({
                      ...current,
                      offset: current.offset + current.limit,
                    }))}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                  >
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setServiceGroups([])
            setSelectedServiceGroupId('')
            setLoadingEditContext(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editDialog.title')}</DialogTitle>
            <DialogDescription>{t('editDialog.description')}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('editDialog.firstName')}</Label>
                  <Input
                    value={editingUser.firstname || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, firstname: e.target.value })}
                    placeholder={t('editDialog.firstNamePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('editDialog.lastName')}</Label>
                  <Input
                    value={editingUser.lastname || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, lastname: e.target.value })}
                    placeholder={t('editDialog.lastNamePlaceholder')}
                  />
                </div>
              </div>
              <div>
                <Label>{t('editDialog.email')}</Label>
                <Input value={editingUser.email} disabled />
              </div>
              <div>
                <Label>{t('editDialog.role')}</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value: 'customer' | 'staff' | 'admin') => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{t('roles.customer')}</SelectItem>
                    <SelectItem value="staff">{t('roles.staff')}</SelectItem>
                    <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('table.region')}</Label>
                <Select
                  value={editingUser.region || ''}
                  onValueChange={(value) => setEditingUser({ ...editingUser, region: value })}
                  disabled={editingUser.role === 'customer'}
                >
                    <SelectTrigger>
                      <SelectValue placeholder={t('editDialog.regionPlaceholder')} />
                    </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region.value} value={region.value}>
                        {tRegions(region.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingUser.role === 'customer' ? t('serviceGroup.regionHint') : t('roles.staffRegionHint')}
                </p>
              </div>
              {editingUser.role === 'customer' && (
                <div>
                  <Label>{t('serviceGroup.title')}</Label>
                  <Select value={selectedServiceGroupId} onValueChange={setSelectedServiceGroupId}>
                    <SelectTrigger disabled={loadingEditContext}>
                      <SelectValue
                        placeholder={loadingEditContext ? tCommon('loading') : t('serviceGroup.placeholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>{t('editDialog.phone')}</Label>
                <Input
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('editDialog.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('editDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChangeUser?.active ? t('statusDialog.disableTitle') : t('statusDialog.activateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeUser?.active
                ? t('statusDialog.disableDescription', { email: statusChangeUser?.email ?? '' })
                : t('statusDialog.activateDescription', { email: statusChangeUser?.email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingStatus}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={changingStatus}>
              {changingStatus ? tCommon('loading') : tCommon('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Users Dialog */}
      <UserImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => fetchUsers()}
      />
    </div>
  )
}

