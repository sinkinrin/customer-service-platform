'use client'
import { useTranslations } from 'next-intl'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { isValidRegion, type RegionValue } from '@/lib/constants/regions'

interface RegionData {
    region: string
    total: number
    open: number
    closed: number
}

interface RegionDistributionChartProps {
    data?: RegionData[]
    loading?: boolean
    className?: string
}

export function RegionDistributionChart({ data, loading, className }: RegionDistributionChartProps) {
    const t = useTranslations('admin.dashboard')
    const tRegions = useTranslations('common.regions')

    const chartConfig = {
        open: { label: t('regionalDistribution.open'), color: 'hsl(var(--warning))' },
        closed: { label: t('regionalDistribution.closed'), color: 'hsl(var(--success))' },
    } satisfies ChartConfig

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base font-medium">{t('regionalDistribution.title')}</CardTitle>
                    <CardDescription>{t('regionalDistribution.description')}</CardDescription>
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
                    <CardTitle className="text-base font-medium">{t('regionalDistribution.title')}</CardTitle>
                    <CardDescription>{t('regionalDistribution.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        {t('regionalDistribution.noData')}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Sort by total descending and hydrate labels from i18n
    const sortedData = [...data]
        .sort((a, b) => b.total - a.total)
        .map((item) => ({
            ...item,
            label: item.region === 'unassigned'
                ? tRegions('unassigned')
                : isValidRegion(item.region)
                    ? tRegions(item.region as RegionValue)
                    : item.region,
        }))

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-base font-medium">{t('regionalDistribution.title')}</CardTitle>
                <CardDescription>{t('regionalDistribution.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
                            width={120}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            tickLine={{ stroke: 'hsl(var(--muted))' }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
                        <Bar dataKey="closed" stackId="a" fill="var(--color-closed)" />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
