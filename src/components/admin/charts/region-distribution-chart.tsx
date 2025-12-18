'use client'

import { useEffect, useState } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { REGIONS } from '@/lib/constants/regions'

interface RegionData {
    region: string
    label: string
    total: number
    open: number
    closed: number
}

interface RegionDistributionChartProps {
    data?: RegionData[]
    loading?: boolean
    className?: string
}

// Color palette for regions
const COLORS = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#14b8a6', // teal
]

export function RegionDistributionChart({ data, loading, className }: RegionDistributionChartProps) {
    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Regional Distribution</CardTitle>
                    <CardDescription>Tickets by service region</CardDescription>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        )
    }

    if (!data || data.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base font-medium">Regional Distribution</CardTitle>
                    <CardDescription>Tickets by service region</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No regional data available
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Sort by total descending
    const sortedData = [...data].sort((a, b) => b.total - a.total)

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-base font-medium">Regional Distribution</CardTitle>
                <CardDescription>Tickets by service region</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                        data={sortedData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            type="number"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            tickLine={{ stroke: 'hsl(var(--muted))' }}
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            width={80}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            tickLine={{ stroke: 'hsl(var(--muted))' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '0.5rem',
                            }}
                        />
                        <Bar dataKey="open" name="Open" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="closed" name="Closed" stackId="a" fill="#22c55e" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
