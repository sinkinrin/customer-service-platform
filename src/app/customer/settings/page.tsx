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
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (user) {
      setPersonalInfo({
        fullName: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        language: user.language || 'zh-CN',
      })
    }
  }, [user])

  const handleSavePersonalInfo = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(tToast('personalInfoUpdated'))
    } catch {
      toast.error(tToast('updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(tToast('notificationsUpdated'))
    } catch {
      toast.error(tToast('updateFailed'))
    } finally {
      setLoading(false)
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

    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(tToast('passwordUpdated'))
      setSecurity({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch {
      toast.error(tToast('passwordUpdateFailed'))
    } finally {
      setLoading(false)
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

            <Button onClick={handleSavePersonalInfo} disabled={loading}>
              {loading ? tPersonal('saving') : tPersonal('saveChanges')}
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

            <Button onClick={handleSaveNotifications} disabled={loading}>
              {loading ? tNotifications('saving') : tNotifications('saveChanges')}
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

            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? tSecurity('updating') : tSecurity('updatePassword')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

