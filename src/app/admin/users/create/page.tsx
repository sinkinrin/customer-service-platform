'use client'

/**
 * Admin Create User Page
 *
 * Allows administrators to create new users with role and routing assignment
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { REGIONS, type RegionValue } from '@/lib/constants/regions'
import Link from 'next/link'

type ServiceBaseRegion =
  | 'AFRICA'
  | 'MIDDLE_EAST'
  | 'ASIA_PACIFIC'
  | 'NORTH_AMERICA'
  | 'LATIN_AMERICA'
  | 'EUROPE_ZONE_1'
  | 'EUROPE_ZONE_2'
  | 'CIS'

interface ServiceGroupOption {
  id: number
  name: string
  baseRegion: ServiceBaseRegion
  isActive: boolean
}

const BASE_REGION_TO_REGION: Record<ServiceBaseRegion, RegionValue> = {
  AFRICA: 'africa',
  MIDDLE_EAST: 'middle-east',
  ASIA_PACIFIC: 'asia-pacific',
  NORTH_AMERICA: 'north-america',
  LATIN_AMERICA: 'latin-america',
  EUROPE_ZONE_1: 'europe-zone-1',
  EUROPE_ZONE_2: 'europe-zone-2',
  CIS: 'cis',
}

export default function CreateUserPage() {
  const router = useRouter()
  const t = useTranslations('admin.users')
  const tToast = useTranslations('toast.admin.users')
  const tCommon = useTranslations('common')
  const tRegions = useTranslations('common.regions')
  const tLocaleNames = useTranslations('common.localeNames')
  const [loading, setLoading] = useState(false)
  const [loadingServiceGroups, setLoadingServiceGroups] = useState(false)
  const [serviceGroups, setServiceGroups] = useState<ServiceGroupOption[]>([])

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'customer' as 'customer' | 'staff' | 'admin',
    region: 'asia-pacific',
    serviceGroupId: '',
    phone: '',
    language: 'zh-CN',
  })

  useEffect(() => {
    if (formData.role !== 'customer' || serviceGroups.length > 0) {
      return
    }

    let active = true

    async function loadServiceGroups() {
      setLoadingServiceGroups(true)
      try {
        const response = await fetch('/api/admin/service-groups')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || tToast('loadError'))
        }

        if (!active) {
          return
        }

        setServiceGroups(
          (data.data?.serviceGroups || []).filter((group: ServiceGroupOption) => group.isActive)
        )
      } catch (error: any) {
        if (active) {
          toast.error(error.message || tToast('loadError'))
        }
      } finally {
        if (active) {
          setLoadingServiceGroups(false)
        }
      }
    }

    void loadServiceGroups()

    return () => {
      active = false
    }
  }, [formData.role, serviceGroups.length])

  const selectedServiceGroup = useMemo(
    () => serviceGroups.find((group) => String(group.id) === formData.serviceGroupId),
    [formData.serviceGroupId, serviceGroups]
  )

  const customerRegion = selectedServiceGroup
    ? BASE_REGION_TO_REGION[selectedServiceGroup.baseRegion]
    : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.role === 'customer' && !formData.serviceGroupId) {
      toast.error(tToast('validationError'))
      return
    }

    setLoading(true)

    try {
      const payload: Record<string, string | number> = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
        phone: formData.phone,
        language: formData.language,
      }

      if (formData.role === 'customer') {
        payload.serviceGroupId = Number(formData.serviceGroupId)
      } else {
        payload.region = formData.region
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          // Validation errors
          data.errors.forEach((error: any) => {
            toast.error(error.message || tToast('validationError'))
          })
        } else {
          throw new Error(data.message || tToast('createError'))
        }
        return
      }

      toast.success(tToast('createSuccess'))
      router.push('/admin/users')
    } catch (error: any) {
      console.error('Failed to create user:', error)
      toast.error(error.message || tToast('createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('createPage.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('createPage.description')}
          </p>
        </div>
        <Link href="/admin/users">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('createPage.backToUsers')}
          </Button>
        </Link>
      </div>

      {/* Create User Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('createPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('createPage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('form.emailRequired')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('form.emailPlaceholder')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('form.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('form.passwordPlaceholder')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
              <p className="text-sm text-muted-foreground">
                {t('form.passwordHint')}
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">{t('form.fullNameLabel')}</Label>
              <Input
                id="full_name"
                type="text"
                placeholder={t('form.fullNamePlaceholder')}
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">{t('form.roleLabel')}</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t('roles.customerDesc')}</SelectItem>
                  <SelectItem value="staff">{t('roles.staffDesc')}</SelectItem>
                  <SelectItem value="admin">{t('roles.adminDesc')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {formData.role === 'customer' && t('roles.customerPermission')}
                {formData.role === 'staff' && t('roles.staffPermission')}
                {formData.role === 'admin' && t('roles.adminPermission')}
              </p>
            </div>

            {formData.role === 'customer' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service-group">{t('serviceGroup.title')}</Label>
                  <Select
                    value={formData.serviceGroupId}
                    onValueChange={(value) => setFormData({ ...formData, serviceGroupId: value })}
                  >
                    <SelectTrigger id="service-group">
                      <SelectValue placeholder={loadingServiceGroups ? tCommon('loading') : t('serviceGroup.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">{t('form.regionLabel')}</Label>
                  <Input
                    id="region"
                    value={customerRegion ? tRegions(customerRegion) : ''}
                    placeholder={t('serviceGroup.placeholder')}
                    readOnly
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('serviceGroup.regionHint')}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="region">{t('form.regionLabel')}</Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) => setFormData({ ...formData, region: value })}
                >
                  <SelectTrigger id="region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {tRegions(region.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t('roles.staffRegionHint')}
                </p>
              </div>
            )}

            {/* Phone (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('form.phoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('form.phonePlaceholder')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">{t('form.languageLabel')}</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">{tLocaleNames('zh-CN')}</SelectItem>
                  <SelectItem value="en">{tLocaleNames('en')}</SelectItem>
                  <SelectItem value="fr">{tLocaleNames('fr')}</SelectItem>
                  <SelectItem value="es">{tLocaleNames('es')}</SelectItem>
                  <SelectItem value="ru">{tLocaleNames('ru')}</SelectItem>
                  <SelectItem value="pt">{tLocaleNames('pt')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Link href="/admin/users">
                <Button type="button" variant="outline" disabled={loading}>
                  {t('createPage.cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading || (formData.role === 'customer' && (!formData.serviceGroupId || loadingServiceGroups))}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" />
                {t('createPage.createButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

