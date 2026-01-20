'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'
import { User, Bell, Lock } from 'lucide-react'

export default function CustomerSettingsPage() {
  const { user } = useAuth()
  const t = useTranslations('customer.settings')
  const tPersonal = useTranslations('customer.settings.personalInfo')
  const tNotifications = useTranslations('customer.settings.notifications')
  const tSecurity = useTranslations('customer.settings.security')
  const tToast = useTranslations('customer.settings.toast')
  const tCommon = useTranslations('common.localeNames')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Personal Information
  const [personalInfo, setPersonalInfo] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    language: user?.language || 'zh-CN',
  })

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    desktopNotifications: false,
    ticketUpdates: true,
    conversationReplies: true,
    promotions: false,
  })

  // Security Settings
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Load profile and preferences on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch profile and preferences in parallel
        const [profileRes, prefsRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/user/preferences'),
        ])

        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.success && profileData.data?.profile) {
            const profile = profileData.data.profile
            setPersonalInfo({
              fullName: profile.full_name || '',
              email: profile.email || '',
              phone: profile.phone || '',
              language: profile.language || 'zh-CN',
            })
          }
        }

        if (prefsRes.ok) {
          const prefsData = await prefsRes.json()
          if (prefsData.success && prefsData.data?.preferences) {
            setNotifications(prefsData.data.preferences)
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    loadData()
  }, [])

  // Also update from user session when it changes
  useEffect(() => {
    if (user && initialLoading) {
      setPersonalInfo({
        fullName: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        language: user.language || 'zh-CN',
      })
    }
  }, [user, initialLoading])

  const handleSavePersonalInfo = async () => {
    setLoadingProfile(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: personalInfo.fullName,
          phone: personalInfo.phone,
          language: personalInfo.language,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(tToast('personalInfoUpdated'))
      } else {
        toast.error(data.error?.message || tToast('updateFailed'))
      }
    } catch {
      toast.error(tToast('updateFailed'))
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleSaveNotifications = async () => {
    setLoadingNotifications(true)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(tToast('notificationsUpdated'))
      } else {
        toast.error(data.error?.message || tToast('updateFailed'))
      }
    } catch {
      toast.error(tToast('updateFailed'))
    } finally {
      setLoadingNotifications(false)
    }
  }

  const handleChangePassword = async () => {
    if (security.newPassword !== security.confirmPassword) {
      toast.error(tToast('passwordMismatch'))
      return
    }

    if (security.newPassword.length < 8) {
      toast.error(tToast('passwordTooShort'))
      return
    }

    setLoadingPassword(true)
    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: security.currentPassword,
          newPassword: security.newPassword,
          confirmPassword: security.confirmPassword,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(tToast('passwordUpdated'))
        setSecurity({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        // Handle validation errors
        if (data.error?.details?.[0]?.path?.includes('currentPassword')) {
          toast.error(tToast('incorrectPassword') || 'Current password is incorrect')
        } else {
          toast.error(data.error?.message || tToast('passwordUpdateFailed'))
        }
      }
    } catch {
      toast.error(tToast('passwordUpdateFailed'))
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('pageTitle')}</h1>
        <p className="text-muted-foreground">{t('pageDescription')}</p>
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>{tPersonal('title')}</CardTitle>
            </div>
            <CardDescription>{tPersonal('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">{tPersonal('fullNameLabel')}</Label>
                <Input
                  id="fullName"
                  value={personalInfo.fullName}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                  placeholder={tPersonal('fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{tPersonal('emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={personalInfo.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{tPersonal('phoneLabel')}</Label>
                <Input
                  id="phone"
                  value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  placeholder={tPersonal('phonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">{tPersonal('languageLabel')}</Label>
                <Select
                  value={personalInfo.language}
                  onValueChange={(value) => setPersonalInfo({ ...personalInfo, language: value })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">{tCommon('zh-CN')}</SelectItem>
                    <SelectItem value="en">{tCommon('en')}</SelectItem>
                    <SelectItem value="fr">{tCommon('fr')}</SelectItem>
                    <SelectItem value="es">{tCommon('es')}</SelectItem>
                    <SelectItem value="ru">{tCommon('ru')}</SelectItem>
                    <SelectItem value="pt">{tCommon('pt')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSavePersonalInfo} disabled={loadingProfile}>
              {loadingProfile ? tPersonal('saving') : tPersonal('saveChanges')}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>{tNotifications('title')}</CardTitle>
            </div>
            <CardDescription>{tNotifications('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">{tNotifications('email.label')}</Label>
                <p className="text-sm text-muted-foreground">{tNotifications('email.description')}</p>
              </div>
              <Switch
                id="emailNotifications"
                checked={notifications.emailNotifications}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, emailNotifications: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="desktopNotifications">{tNotifications('desktop.label')}</Label>
                <p className="text-sm text-muted-foreground">{tNotifications('desktop.description')}</p>
              </div>
              <Switch
                id="desktopNotifications"
                checked={notifications.desktopNotifications}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, desktopNotifications: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ticketUpdates">{tNotifications('ticketUpdates.label')}</Label>
                <p className="text-sm text-muted-foreground">{tNotifications('ticketUpdates.description')}</p>
              </div>
              <Switch
                id="ticketUpdates"
                checked={notifications.ticketUpdates}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, ticketUpdates: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="conversationReplies">{tNotifications('conversationReplies.label')}</Label>
                <p className="text-sm text-muted-foreground">{tNotifications('conversationReplies.description')}</p>
              </div>
              <Switch
                id="conversationReplies"
                checked={notifications.conversationReplies}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, conversationReplies: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promotions">{tNotifications('promotions.label')}</Label>
                <p className="text-sm text-muted-foreground">{tNotifications('promotions.description')}</p>
              </div>
              <Switch
                id="promotions"
                checked={notifications.promotions}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, promotions: checked })
                }
              />
            </div>

            <Button onClick={handleSaveNotifications} disabled={loadingNotifications}>
              {loadingNotifications ? tNotifications('saving') : tNotifications('saveChanges')}
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>{tSecurity('title')}</CardTitle>
            </div>
            <CardDescription>{tSecurity('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{tSecurity('currentPasswordLabel')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={security.currentPassword}
                onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                placeholder={tSecurity('currentPasswordPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{tSecurity('newPasswordLabel')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={security.newPassword}
                onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                placeholder={tSecurity('newPasswordPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{tSecurity('confirmPasswordLabel')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={security.confirmPassword}
                onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                placeholder={tSecurity('confirmPasswordPlaceholder')}
              />
            </div>

            <Button onClick={handleChangePassword} disabled={loadingPassword}>
              {loadingPassword ? tSecurity('updating') : tSecurity('updatePassword')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

