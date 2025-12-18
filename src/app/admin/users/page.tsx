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

interface User {
  user_id: string
  email: string
  full_name: string
  role: 'customer' | 'staff' | 'admin'
  phone?: string
  language?: string
  region?: string
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
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 })
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      })
      if (search) params.append('search', search)
      if (roleFilter !== 'all') params.append('role', roleFilter)

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
  }, [roleFilter]) // Re-fetch when role filter changes

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
      const response = await fetch(`/api/admin/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editingUser.role,
          full_name: editingUser.full_name,
          phone: editingUser.phone,
          language: editingUser.language,
        }),
      })

      if (!response.ok) throw new Error('Failed to update user')

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
                    <TableHead>{t('table.phone')}</TableHead>
                    <TableHead>{t('table.createdAt')}</TableHead>
                    <TableHead>{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users
                    .filter(user => regionFilter === 'all' || user.region === regionFilter)
                    .map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getRegionLabel(user.region)}</TableCell>
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
                  onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}
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
    </div>
  )
}

