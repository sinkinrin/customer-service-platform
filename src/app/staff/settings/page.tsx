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
import { Save, User, Bell, Globe, Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'

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
  const [saving, setSaving] = useState(false)
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
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        language: user.user_metadata?.language || 'en',
      }))
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Simulate API call - in production, this would update user settings
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <User className="h-5 w-5" />
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
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
                Change Avatar
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG or GIF. Max size 2MB
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={settings.full_name}
                onChange={(e) =>
                  setSettings({ ...settings, full_name: e.target.value })
                }
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) =>
                  setSettings({ ...settings, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
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
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
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
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
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
              <Label>Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show desktop notifications for updates
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
              <Label>New Ticket Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new tickets are assigned
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
              <Label>New Message Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about new conversation messages
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
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your work environment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-assign Tickets</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign new tickets to you
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
              <Label>Show Closed Tickets</Label>
              <p className="text-sm text-muted-foreground">
                Display closed tickets in the main view
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
            <Label htmlFor="defaultView">Default View</Label>
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
                <SelectItem value="list">List View</SelectItem>
                <SelectItem value="grid">Grid View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Lock className="h-5 w-5" />
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" disabled>
            Change Password
          </Button>
          <p className="text-sm text-muted-foreground">
            Password management is currently disabled in demo mode
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

