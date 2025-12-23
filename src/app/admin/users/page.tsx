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
import { REGIONS } from '@/lib/constants/regions'
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
  role: 'customer' | 'staff' | 'admin'
  phone?: string
  language?: string
  region?: string
  active?: boolean
  zammad_id?: number
  created_at: string
}

export default function UsersPage() {
  const t = useTranslations('admin.users')
  const tToast = useTranslations('toast.admin.users')
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

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
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
        setPagination(result.data.pagination || { limit: 20, offset: 0, total: 0 })
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
  }, [roleFilter, regionFilter, statusFilter]) // Re-fetch when filters change

  const handleSearch = () => {
    setPagination({ ...pagination, offset: 0 })
    fetchUsers()
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingUser) return

    setSaving(true)
    try {
      const updateData: Record<string, unknown> = {
        role: editingUser.role,
        full_name: editingUser.full_name,
        phone: editingUser.phone,
        language: editingUser.language,
      }
      // Only include region if it has a valid value
      if (editingUser.region) {
        updateData.region = editingUser.region
      }

      const response = await fetch(`/api/admin/users/${editingUser.zammad_id || editingUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to update user')
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
    const region = REGIONS.find(r => r.value === regionValue)
    return region?.labelEn || regionValue
  }

  const handleStatusToggle = (user: User) => {
    setStatusChangeUser(user)
    setStatusDialogOpen(true)
  }

  const confirmStatusChange = async () => {
    if (!statusChangeUser || !statusChangeUser.zammad_id) {
      toast.error('Cannot change status: missing Zammad ID')
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

      toast.success(statusChangeUser.active ? 'User disabled' : 'User activated')
      setStatusDialogOpen(false)
      fetchUsers()
    } catch (error) {
      toast.error('Failed to change user status')
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
              Import Users
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
                    {region.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
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
                    <TableHead>Status</TableHead>
                    <TableHead>{t('table.phone')}</TableHead>
                    <TableHead>{t('table.createdAt')}</TableHead>
                    <TableHead>{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getRegionLabel(user.region)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.active !== false}
                            onCheckedChange={() => handleStatusToggle(user)}
                            disabled={!user.zammad_id}
                          />
                          <Badge variant={user.active !== false ? 'default' : 'secondary'}>
                            {user.active !== false ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
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
                    onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
                    disabled={pagination.offset === 0}
                  >
                    {t('pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
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
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editDialog.title')}</DialogTitle>
            <DialogDescription>{t('editDialog.description')}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label>{t('editDialog.name')}</Label>
                <Input
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                />
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Region determines which tickets staff can access
                </p>
              </div>
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
              {statusChangeUser?.active ? 'Disable User' : 'Activate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeUser?.active
                ? `Are you sure you want to disable ${statusChangeUser?.email}? They will not be able to log in.`
                : `Are you sure you want to activate ${statusChangeUser?.email}? They will be able to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={changingStatus}>
              {changingStatus ? 'Processing...' : 'Confirm'}
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

