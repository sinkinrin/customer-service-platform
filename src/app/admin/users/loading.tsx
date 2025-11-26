import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getTranslations } from 'next-intl/server'

export default async function UsersLoading() {
  const t = await getTranslations('admin.users')
  const tTable = await getTranslations('admin.users.table')

  const rows = Array.from({ length: 6 })
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-6 bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
              <span>{tTable('name')}</span>
              <span>{tTable('email')}</span>
              <span>{tTable('role')}</span>
              <span>{tTable('phone')}</span>
              <span>{tTable('createdAt')}</span>
              <span className="text-right">{tTable('actions')}</span>
            </div>
            <div className="divide-y">
              {rows.map((_, idx) => (
                <div key={idx} className="grid grid-cols-6 items-center px-4 py-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-28" />
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
