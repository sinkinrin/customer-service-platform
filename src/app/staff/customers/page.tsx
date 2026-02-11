'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Users, Mail, Phone, MapPin, Calendar, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { TicketHistoryDialog } from '@/components/admin/ticket-history-dialog'

interface Customer {
  user_id: string
  email: string
  full_name: string
  phone?: string
  region?: string
  language?: string
  created_at: string
  role: string
}

export default function StaffCustomersPage() {
  const t = useTranslations('staff.customers')
  const tStats = useTranslations('staff.customers.stats')
  const tFilter = useTranslations('staff.customers.filter')
  const tList = useTranslations('staff.customers.list')
  const tTable = useTranslations('staff.customers.table')
  const tToast = useTranslations('toast.staff.customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch customers')

      const data = await response.json()
      // Filter only active customers (exclude inactive/disabled users)
      const customerList = (data.data?.users || []).filter(
        (user: Customer & { active?: boolean }) => user.role === 'customer' && user.active !== false
      )
      setCustomers(customerList)
    } catch (error) {
      console.error('Failed to load customers:', error)
      toast.error(tToast('loadError'))
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = !searchQuery || 
      customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRegion = regionFilter === 'all' || customer.region === regionFilter

    return matchesSearch && matchesRegion
  })

  const regions = Array.from(new Set(customers.map((c) => c.region).filter(Boolean)))

  const stats = {
    total: customers.length,
    withPhone: customers.filter((c) => c.phone).length,
    byRegion: regions.length,
  }

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {stats.total} {tStats('totalCustomers')}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Phone className="h-3 w-3" />
            {stats.withPhone}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {stats.byRegion} {tStats('regions')}
          </Badge>
        </div>
      </div>

      {/* Customers Table with Integrated Filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{tList('title')}</CardTitle>
              <CardDescription className="text-xs">
                {tList('found', { count: filteredCustomers.length })}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tFilter('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 w-full sm:w-64"
                />
              </div>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <MapPin className="h-3 w-3 mr-1" />
                  <SelectValue placeholder={tFilter('regionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tFilter('allRegions')}</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region || ''}>
                      {region || tTable('unknown')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={loadCustomers} variant="outline" size="sm" className="h-9">
                {tFilter('refresh')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-solid border-current border-r-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">{tList('loading')}</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">{tList('noCustomers')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? tList('adjustSearch') : tList('noData')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tTable('customer')}</TableHead>
                  <TableHead>{tTable('email')}</TableHead>
                  <TableHead>{tTable('phone')}</TableHead>
                  <TableHead>{tTable('region')}</TableHead>
                  <TableHead>{tTable('language')}</TableHead>
                  <TableHead>{tTable('joined')}</TableHead>
                  <TableHead className="text-right">{tTable('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.user_id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {customer.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{customer.full_name || tTable('unknown')}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {customer.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.region ? (
                        <Badge variant="outline">{customer.region}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.language ? (
                        <Badge variant="secondary">{customer.language}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(customer.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setTicketDialogOpen(true)
                        }}
                      >
                        <Ticket className="h-4 w-4 mr-1" />
                        {tTable('viewTickets')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ticket History Dialog */}
      {selectedCustomer && (
        <TicketHistoryDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          userId={selectedCustomer.user_id}
          userName={selectedCustomer.full_name}
          userEmail={selectedCustomer.email}
          ticketBasePath="/staff/tickets"
        />
      )}
    </div>
  )
}

