'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { REGIONS } from '@/lib/constants/regions'

interface UserData {
    id: number
    email: string
    full_name: string
    firstname: string
    lastname: string
    role: string
    region?: string
    phone?: string
    active: boolean
}

export default function EditUserPage() {
    const params = useParams()
    const router = useRouter()
    const userId = params?.id as string
    const t = useTranslations('admin.users')
    const tToast = useTranslations('toast.admin.users')
    const tRegions = useTranslations('common.regions')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [user, setUser] = useState<UserData | null>(null)
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        phone: '',
        region: '',
        active: true,
    })

    useEffect(() => {
        const fetchUser = async () => {
            if (!userId) return

            try {
                const response = await fetch(`/api/admin/users/${userId}`)
                const data = await response.json()

                if (data.success && data.data?.user) {
                    const u = data.data.user
                    setUser(u)
                    setFormData({
                        firstname: u.firstname || '',
                        lastname: u.lastname || '',
                        phone: u.phone || '',
                        region: u.region || '',
                        active: u.active,
                    })
                } else {
                    toast.error(tToast('loadError'))
                    router.push('/admin/users')
                }
            } catch {
                toast.error(tToast('loadError'))
                router.push('/admin/users')
            } finally {
                setLoading(false)
            }
        }

        fetchUser()
    }, [userId, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setSaving(true)
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (data.success) {
                toast.success(tToast('updateSuccess'))
                router.push(`/admin/users/${userId}`)
            } else {
                toast.error(data.error || tToast('updateError'))
            }
        } catch {
            toast.error(tToast('updateError'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-96" />
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/users/${userId}`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{t('editUser')}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('createPage.cardTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="firstname">{t('editDialog.firstName')}</Label>
                                <Input
                                    id="firstname"
                                    value={formData.firstname}
                                    onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                                    placeholder={t('editDialog.firstNamePlaceholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastname">{t('editDialog.lastName')}</Label>
                                <Input
                                    id="lastname"
                                    value={formData.lastname}
                                    onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                                    placeholder={t('editDialog.lastNamePlaceholder')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">{t('editDialog.email')}</Label>
                            <Input id="email" value={user.email} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">{t('editDialog.emailHint')}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">{t('editDialog.phone')}</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1234567890"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">{t('editDialog.role')}</Label>
                            <Input id="role" value={t(`roles.${user.role}`)} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">{t('editDialog.roleHint')}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="region">{t('table.region')}</Label>
                            <Select
                                value={formData.region}
                                onValueChange={(value) => setFormData({ ...formData, region: value })}
                            >
                                <SelectTrigger id="region">
                                    <SelectValue placeholder={t('editDialog.regionPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {REGIONS.map((region) => (
                                        <SelectItem key={region.value} value={region.value}>
                                            {tRegions(region.value)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {t('roles.staffRegionHint')}
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>{t('editDialog.accountStatus')}</Label>
                                <p className="text-sm text-muted-foreground">{t('editDialog.accountStatusHint')}</p>
                            </div>
                            <Switch
                                checked={formData.active}
                                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                {t('editDialog.saveChanges')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.push(`/admin/users/${userId}`)}>
                                {t('editDialog.cancel')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
