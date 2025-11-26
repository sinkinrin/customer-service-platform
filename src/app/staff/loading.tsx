import { PageLoader } from "@/components/ui/page-loader"
import { getTranslations } from 'next-intl/server'

export default async function StaffLoading() {
  const t = await getTranslations('staff.loading')

  return (
    <PageLoader
      message={t('message')}
      hint={t('hint')}
    />
  )
}
