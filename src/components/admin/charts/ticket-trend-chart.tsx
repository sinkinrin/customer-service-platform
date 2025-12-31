'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface TrendData {
    date: string
    new: number      // 当日新增工单数
    closed: number   // 当日关闭工单数
}

interface TicketTrendChartProps {
    className?: string
}

export function TicketTrendChart({ className }: TicketTrendChartProps) {
    const t = useTranslations('admin.dashboard')
    const [data, setData] = useState<TrendData[]>([])
    const [range, setRange] = useState('7d')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [range])

    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/admin/stats/tickets?range=${range}`)
            if (!response.ok) throw new Error('Failed to fetch')
            const result = await response.json()
            if (result.success) {
                setData(result.data.trend)
            } else {
                throw new Error(result.error || 'Unknown error')
            }
        } catch (err) {
            setError(t('ticketTrends.loadError'))
            console.error('[TicketTrendChart] Error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-base font-medium">{t('ticketTrends.title')}</CardTitle>
                    <CardDescription>{t('ticketTrends.description')}</CardDescription>
                </div>
                <Select value={range} onValueChange={setRange}>
                    <SelectTrigger className="w-[100px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">{t('ticketTrends.range.7d')}</SelectItem>
                        <SelectItem value="30d">{t('ticketTrends.range.30d')}</SelectItem>
                        <SelectItem value="90d">{t('ticketTrends.range.90d')}</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                ) : error ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        {error}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatDate}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={{ stroke: 'hsl(var(--muted))' }}
                            />
                            <YAxis
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={{ stroke: 'hsl(var(--muted))' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '0.5rem',
                                }}
                                labelFormatter={formatDate}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="new"
                                name={t('ticketTrends.series.new')}
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorNew)"
                            />
                            <Area
                                type="monotone"
                                dataKey="closed"
                                name={t('ticketTrends.series.closed')}
                                stroke="#22c55e"
                                fillOpacity={1}
                                fill="url(#colorClosed)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
