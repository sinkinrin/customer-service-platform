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

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [user, setUser] = useState<UserData | null>(null)
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        phone: '',
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
                        active: u.active,
                    })
                } else {
                    toast.error('User not found')
                    router.push('/admin/users')
                }
            } catch (error) {
                toast.error('Failed to load user')
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
                toast.success('User updated successfully')
                router.push(`/admin/users/${userId}`)
            } else {
                toast.error(data.error || 'Failed to update user')
            }
        } catch (error) {
            toast.error('Failed to update user')
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
                    <h1 className="text-2xl font-bold">Edit User</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>User Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="firstname">First Name</Label>
                                <Input
                                    id="firstname"
                                    value={formData.firstname}
                                    onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                                    placeholder="First name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastname">Last Name</Label>
                                <Input
                                    id="lastname"
                                    value={formData.lastname}
                                    onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user.email} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1234567890"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Input id="role" value={user.role} disabled className="bg-muted capitalize" />
                            <p className="text-xs text-muted-foreground">Role changes require additional permissions</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>Account Status</Label>
                                <p className="text-sm text-muted-foreground">Enable or disable this account</p>
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
                                Save Changes
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.push(`/admin/users/${userId}`)}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
