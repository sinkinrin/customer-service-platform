'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    Globe,
    Calendar,
    Shield,
    Ticket,
    Clock,
    CheckCircle,
    XCircle,
    Edit,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { REGIONS } from '@/lib/constants/regions'
import { TicketHistoryDialog } from '@/components/admin/ticket-history-dialog'

interface UserDetails {
    id: number
    user_id: string
    email: string
    full_name: string
    firstname: string
    lastname: string
    role: 'admin' | 'staff' | 'customer'
    region?: string
    phone?: string
    language?: string
    active: boolean
    verified: boolean
    out_of_office: boolean
    out_of_office_start_at?: string
    out_of_office_end_at?: string
    created_at: string
    updated_at: string
    last_login?: string
    tickets_open: number
    tickets_closed: number
}

export default function UserDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const userId = params?.id as string

    const [user, setUser] = useState<UserDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ticketHistoryOpen, setTicketHistoryOpen] = useState(false)

    useEffect(() => {
        const fetchUser = async () => {
            if (!userId) return

            setLoading(true)
            try {
                const response = await fetch(`/api/admin/users/${userId}`)
                const data = await response.json()

                if (data.success && data.data?.user) {
                    setUser(data.data.user)
                } else {
                    setError(data.error || 'User not found')
                }
            } catch (err) {
                setError('Failed to load user')
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchUser()
    }, [userId])

    const getRegionLabel = (regionValue?: string) => {
        if (!regionValue) return '-'
        const region = REGIONS.find(r => r.value === regionValue)
        return region?.labelEn || regionValue
    }

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'admin': return 'destructive'
            case 'staff': return 'default'
            default: return 'secondary'
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        )
    }

    if (error || !user) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                        <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
                        <p className="text-muted-foreground mb-4">{error || 'The requested user could not be found.'}</p>
                        <Button onClick={() => router.push('/admin/users')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Users
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/users')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{user.full_name}</h1>
                        <p className="text-muted-foreground">{user.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                    <Badge variant={user.active ? 'default' : 'secondary'}>
                        {user.active ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/admin/users/${userId}/edit`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Basic Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium">{user.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Phone</p>
                                    <p className="font-medium">{user.phone || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Region</p>
                                    <p className="font-medium">{getRegionLabel(user.region)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Role</p>
                                    <p className="font-medium capitalize">{user.role}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Account Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={user.active ? 'default' : 'secondary'}>
                                    {user.active ? 'Active' : 'Disabled'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Verified</span>
                                <Badge variant={user.verified ? 'default' : 'secondary'}>
                                    {user.verified ? 'Yes' : 'No'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Out of Office</span>
                                <Badge variant={user.out_of_office ? 'destructive' : 'secondary'}>
                                    {user.out_of_office ? 'On Vacation' : 'Available'}
                                </Badge>
                            </div>
                            {user.out_of_office && user.out_of_office_end_at && (
                                <div className="text-sm text-muted-foreground">
                                    Returns: {new Date(user.out_of_office_end_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Ticket Statistics */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Ticket className="h-5 w-5" />
                                Ticket Statistics
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setTicketHistoryOpen(true)}
                            >
                                View Tickets
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-3xl font-bold">{user.tickets_open}</p>
                                <p className="text-sm text-muted-foreground">Open Tickets</p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-3xl font-bold">{user.tickets_closed}</p>
                                <p className="text-sm text-muted-foreground">Closed Tickets</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Timestamps */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Created</p>
                                    <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Last Updated</p>
                                    <p className="font-medium">{new Date(user.updated_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            {user.last_login && (
                                <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Last Login</p>
                                        <p className="font-medium">{new Date(user.last_login).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Ticket History Dialog */}
            <TicketHistoryDialog
                open={ticketHistoryOpen}
                onOpenChange={setTicketHistoryOpen}
                userId={userId}
                userName={user.full_name}
                userEmail={user.email}
            />
        </div>
    )
}
