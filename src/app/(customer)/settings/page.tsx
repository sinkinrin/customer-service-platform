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
import { User, Bell, Lock, Globe } from 'lucide-react'

export default function CustomerSettingsPage() {
  const { user } = useAuth()
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
      toast.success('个人信息已更新')
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('通知设置已更新')
    } catch (error) {
      toast.error('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (security.newPassword !== security.confirmPassword) {
      toast.error('新密码与确认密码不匹配')
      return
    }

    if (security.newPassword.length < 8) {
      toast.error('密码长度至少为8个字符')
      return
    }

    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('密码已更新')
      setSecurity({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error) {
      toast.error('密码更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">设置</h1>
        <p className="text-muted-foreground">管理您的账户设置和偏好</p>
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>个人信息</CardTitle>
            </div>
            <CardDescription>更新您的个人资料信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">姓名</Label>
                <Input
                  id="fullName"
                  value={personalInfo.fullName}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                  placeholder="请输入您的姓名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
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
                <Label htmlFor="phone">电话</Label>
                <Input
                  id="phone"
                  value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  placeholder="请输入您的电话号码"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">语言</Label>
                <Select
                  value={personalInfo.language}
                  onValueChange={(value) => setPersonalInfo({ ...personalInfo, language: value })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSavePersonalInfo} disabled={loading}>
              {loading ? '保存中...' : '保存更改'}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>通知设置</CardTitle>
            </div>
            <CardDescription>管理您接收通知的方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">邮件通知</Label>
                <p className="text-sm text-muted-foreground">接收重要更新的邮件通知</p>
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
                <Label htmlFor="desktopNotifications">桌面通知</Label>
                <p className="text-sm text-muted-foreground">在浏览器中显示桌面通知</p>
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
                <Label htmlFor="ticketUpdates">工单更新</Label>
                <p className="text-sm text-muted-foreground">工单状态变更时通知我</p>
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
                <Label htmlFor="conversationReplies">对话回复</Label>
                <p className="text-sm text-muted-foreground">收到新消息时通知我</p>
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
                <Label htmlFor="promotions">促销信息</Label>
                <p className="text-sm text-muted-foreground">接收产品更新和促销信息</p>
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
              {loading ? '保存中...' : '保存更改'}
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>安全设置</CardTitle>
            </div>
            <CardDescription>更改您的密码以保护账户安全</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                value={security.currentPassword}
                onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                placeholder="请输入当前密码"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={security.newPassword}
                onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                placeholder="请输入新密码（至少8个字符）"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={security.confirmPassword}
                onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
              />
            </div>

            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? '更新中...' : '更新密码'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

