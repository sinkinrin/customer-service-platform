'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Save, User, Bell, Globe, Lock, Loader2, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'
import { VacationDialog } from '@/components/staff/vacation-dialog'

interface StaffSettings {
  full_name: string
  email: string
  phone?: string
  language: string
  notifications: {
    email: boolean
    desktop: boolean
    newTicket: boolean
    newMessage: boolean
  }
  preferences: {
    autoAssign: boolean
    showClosedTickets: boolean
    defaultView: 'list' | 'grid'
  }
}

export default function StaffSettingsPage() {
  const { user } = useAuth()
  const t = useTranslations('staff.settings')
  const tPersonal = useTranslations('staff.settings.personalInfo')
  const tNotifications = useTranslations('staff.settings.notifications')
  const tPreferences = useTranslations('staff.settings.preferences')
  const tSecurity = useTranslations('staff.settings.security')
  const tVacation = useTranslations('staff.vacation')
  const tToast = useTranslations('staff.settings.toast')
  const tCommon = useTranslations('common.localeNames')
  const [saving, setSaving] = useState(false)
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false)
  const [vacationStatus, setVacationStatus] = useState<{
    is_on_vacation: boolean
    start_date: string | null
    end_date: string | null
  } | null>(null)
  const [settings, setSettings] = useState<StaffSettings>({
    full_name: '',
    email: '',
    phone: '',
    language: 'en',
    notifications: {
      email: true,
      desktop: true,
      newTicket: true,
      newMessage: true,
    },
    preferences: {
      autoAssign: false,
      showClosedTickets: false,
      defaultView: 'list',
    },
  })

  useEffect(() => {
    if (user) {
      setSettings((prev) => ({
        ...prev,
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        language: user.language || 'en',
      }))
      // Fetch vacation status
      fetchVacationStatus()
    }
  }, [user])

  const fetchVacationStatus = async () => {
    try {
      const res = await fetch('/api/staff/vacation')
      if (res.ok) {
        const data = await res.json()
        // successResponse wraps payload as { success, data }
        if (data.success && data.data?.vacation) {
          setVacationStatus(data.data.vacation)
        } else if (data.error?.message) {
          console.error('Failed to fetch vacation status:', data.error.message)
        }
      }
    } catch (error) {
      console.error('Failed to fetch vacation status:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Simulate API call - in production, this would update user settings
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast.success(tToast('saveSuccess'))
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error(tToast('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('pageDescription')}
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <User className="h-5 w-5" />
            <div>
              <CardTitle>{tPersonal('title')}</CardTitle>
              <CardDescription>{tPersonal('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">
                {settings.full_name?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm" disabled>
                {tPersonal('changeAvatar')}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {tPersonal('avatarHint')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{tPersonal('fullNameLabel')}</Label>
              <Input
                id="full_name"
                value={settings.full_name}
                onChange={(e) =>
                  setSettings({ ...settings, full_name: e.target.value })
                }
                placeholder={tPersonal('fullNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{tPersonal('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {tPersonal('emailHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{tPersonal('phoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) =>
                  setSettings({ ...settings, phone: e.target.value })
                }
                placeholder={tPersonal('phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{tPersonal('languageLabel')}</Label>
              <Select
                value={settings.language}
                onValueChange={(value) =>
                  setSettings({ ...settings, language: value })
                }
              >
                <SelectTrigger id="language">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{tCommon('en')}</SelectItem>
                  <SelectItem value="zh-CN">{tCommon('zh-CN')}</SelectItem>
                  <SelectItem value="fr">{tCommon('fr')}</SelectItem>
                  <SelectItem value="es">{tCommon('es')}</SelectItem>
                  <SelectItem value="ru">{tCommon('ru')}</SelectItem>
                  <SelectItem value="pt">{tCommon('pt')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>{tNotifications('title')}</CardTitle>
              <CardDescription>
                {tNotifications('description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tNotifications('emailLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tNotifications('emailDescription')}
              </p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, email: checked },
                })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tNotifications('desktopLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tNotifications('desktopDescription')}
              </p>
            </div>
            <Switch
              checked={settings.notifications.desktop}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, desktop: checked },
                })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tNotifications('newTicketLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tNotifications('newTicketDescription')}
              </p>
            </div>
            <Switch
              checked={settings.notifications.newTicket}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, newTicket: checked },
                })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tNotifications('newMessageLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tNotifications('newMessageDescription')}
              </p>
            </div>
            <Switch
              checked={settings.notifications.newMessage}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, newMessage: checked },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>{tPreferences('title')}</CardTitle>
          <CardDescription>{tPreferences('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tPreferences('autoAssignLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tPreferences('autoAssignDescription')}
              </p>
            </div>
            <Switch
              checked={settings.preferences.autoAssign}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, autoAssign: checked },
                })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tPreferences('showClosedLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {tPreferences('showClosedDescription')}
              </p>
            </div>
            <Switch
              checked={settings.preferences.showClosedTickets}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, showClosedTickets: checked },
                })
              }
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="defaultView">{tPreferences('defaultViewLabel')}</Label>
            <Select
              value={settings.preferences.defaultView}
              onValueChange={(value: 'list' | 'grid') =>
                setSettings({
                  ...settings,
                  preferences: { ...settings.preferences, defaultView: value },
                })
              }
            >
              <SelectTrigger id="defaultView">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">{tPreferences('listView')}</SelectItem>
                <SelectItem value="grid">{tPreferences('gridView')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vacation Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Plane className="h-5 w-5" />
            <div>
              <CardTitle>{tVacation('title')}</CardTitle>
              <CardDescription>{tVacation('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {vacationStatus?.is_on_vacation ? (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <Plane className="h-3 w-3 mr-1" />
                    {tVacation('title')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {vacationStatus.start_date} ~ {vacationStatus.end_date}
                </p>
              </div>
              <Button variant="outline" onClick={() => setVacationDialogOpen(true)}>
                {tVacation('updateVacation')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setVacationDialogOpen(true)}>
              <Plane className="h-4 w-4 mr-2" />
              {tVacation('setVacation')}
            </Button>
          )}
        </CardContent>
      </Card>

      <VacationDialog
        open={vacationDialogOpen}
        onOpenChange={setVacationDialogOpen}
        onSuccess={fetchVacationStatus}
      />

      {/* Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Lock className="h-5 w-5" />
            <div>
              <CardTitle>{tSecurity('title')}</CardTitle>
              <CardDescription>{tSecurity('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" disabled>
            {tSecurity('changePasswordLabel')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {tSecurity('passwordDisabledHint')}
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('save')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

