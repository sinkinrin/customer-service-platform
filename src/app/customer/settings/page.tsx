'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

interface PersonalInfo {
  fullName: string
  email: string
  phone: string
  language: string
}

interface NotificationPreferences {
  emailNotifications: boolean
  desktopNotifications: boolean
  ticketUpdates: boolean
  conversationReplies: boolean
  promotions: boolean
}

interface SecurityFields {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface ProfilePayload {
  full_name?: string | null
  email?: string | null
  phone?: string | null
  language?: string | null
}

interface SettingsMutationResponse {
  success?: boolean
  data?: {
    outcome?: 'complete' | 'partial'
    profile?: ProfilePayload
    preferences?: NotificationPreferences
    locale?: {
      actual?: string | null
    }
  }
  error?: {
    code?: string
    message?: string
    details?: Array<{
      path?: string[]
    }>
  }
}

interface SessionProfile {
  full_name?: string | null
  email?: string | null
  phone?: string | null
  language?: string | null
}

interface SettingsIdentityLifecycle {
  key: string | null
  userId: string | null
  version: number
  controllers: Set<AbortController>
  confirmedPersonalInfo: PersonalInfo
  confirmedNotifications: NotificationPreferences
}

interface ScopedValue<T> {
  owner: SettingsIdentityLifecycle
  value: T
}

interface SaveRequestToken {
  owner: SettingsIdentityLifecycle
}

function personalInfoFromSession(user?: SessionProfile | null): PersonalInfo {
  return {
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    language: user?.language || 'zh-CN',
  }
}

function defaultNotifications(): NotificationPreferences {
  return {
    emailNotifications: true,
    desktopNotifications: false,
    ticketUpdates: true,
    conversationReplies: true,
    promotions: false,
  }
}

function emptySecurityFields(): SecurityFields {
  return {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

function getDirtyProfileFields(
  submitted: PersonalInfo,
  confirmed: PersonalInfo
): ProfilePayload {
  const updates: ProfilePayload = {}

  if (submitted.fullName !== confirmed.fullName) {
    updates.full_name = submitted.fullName
  }
  if (submitted.phone !== confirmed.phone) {
    updates.phone = submitted.phone
  }
  if (submitted.language !== confirmed.language) {
    updates.language = submitted.language
  }

  return updates
}

function getDirtyNotificationFields(
  submitted: NotificationPreferences,
  confirmed: NotificationPreferences
): Partial<NotificationPreferences> {
  const updates: Partial<NotificationPreferences> = {}

  if (submitted.emailNotifications !== confirmed.emailNotifications) {
    updates.emailNotifications = submitted.emailNotifications
  }
  if (submitted.desktopNotifications !== confirmed.desktopNotifications) {
    updates.desktopNotifications = submitted.desktopNotifications
  }
  if (submitted.ticketUpdates !== confirmed.ticketUpdates) {
    updates.ticketUpdates = submitted.ticketUpdates
  }
  if (submitted.conversationReplies !== confirmed.conversationReplies) {
    updates.conversationReplies = submitted.conversationReplies
  }
  if (submitted.promotions !== confirmed.promotions) {
    updates.promotions = submitted.promotions
  }

  return updates
}

export default function CustomerSettingsPage() {
  const { user, refreshSession } = useAuth()
  const t = useTranslations('customer.settings')
  const tPersonal = useTranslations('customer.settings.personalInfo')
  const tNotifications = useTranslations('customer.settings.notifications')
  const tSecurity = useTranslations('customer.settings.security')
  const tToast = useTranslations('customer.settings.toast')
  const tCommon = useTranslations('common.localeNames')
  const identityKey = user
    ? JSON.stringify({
        id: user.id,
        role: user.role,
        email: user.email,
        zammadId: user.zammad_id ?? null,
      })
    : null
  const identityLifecycleRef = useRef<SettingsIdentityLifecycle | null>(null)

  if (
    !identityLifecycleRef.current ||
    identityLifecycleRef.current.key !== identityKey
  ) {
    const previousVersion = identityLifecycleRef.current?.version ?? 0
    identityLifecycleRef.current = {
      key: identityKey,
      userId: user?.id ?? null,
      version: previousVersion + 1,
      controllers: new Set<AbortController>(),
      confirmedPersonalInfo: personalInfoFromSession(user),
      confirmedNotifications: defaultNotifications(),
    }
  }

  const identityLifecycle = identityLifecycleRef.current
  const [personalInfoState, setPersonalInfoState] = useState<ScopedValue<PersonalInfo>>(() => ({
    owner: identityLifecycle,
    value: identityLifecycle.confirmedPersonalInfo,
  }))
  const [notificationsState, setNotificationsState] = useState<ScopedValue<NotificationPreferences>>(() => ({
    owner: identityLifecycle,
    value: identityLifecycle.confirmedNotifications,
  }))
  const [securityState, setSecurityState] = useState<ScopedValue<SecurityFields>>(() => ({
    owner: identityLifecycle,
    value: emptySecurityFields(),
  }))
  const [loadedIdentity, setLoadedIdentity] = useState<SettingsIdentityLifecycle | null>(null)
  const [loadingProfileToken, setLoadingProfileToken] = useState<SaveRequestToken | null>(null)
  const [loadingNotificationsToken, setLoadingNotificationsToken] = useState<SaveRequestToken | null>(null)
  const [loadingPasswordToken, setLoadingPasswordToken] = useState<SaveRequestToken | null>(null)
  const profileSaveTokenRef = useRef<SaveRequestToken | null>(null)
  const notificationsSaveTokenRef = useRef<SaveRequestToken | null>(null)
  const passwordSaveTokenRef = useRef<SaveRequestToken | null>(null)
  const tToastRef = useRef(tToast)
  tToastRef.current = tToast

  const personalInfo = personalInfoState.owner === identityLifecycle
    ? personalInfoState.value
    : identityLifecycle.confirmedPersonalInfo
  const notifications = notificationsState.owner === identityLifecycle
    ? notificationsState.value
    : identityLifecycle.confirmedNotifications
  const security = securityState.owner === identityLifecycle
    ? securityState.value
    : emptySecurityFields()
  const initialLoading = loadedIdentity !== identityLifecycle
  const loadingProfile = loadingProfileToken?.owner === identityLifecycle
  const loadingNotifications = loadingNotificationsToken?.owner === identityLifecycle
  const loadingPassword = loadingPasswordToken?.owner === identityLifecycle

  const applyProfileForIdentity = useCallback((
    owner: SettingsIdentityLifecycle,
    profile: ProfilePayload,
    actualLocale?: string | null
  ) => {
    if (identityLifecycleRef.current !== owner) return

    const nextProfile: PersonalInfo = {
      fullName: profile.full_name ?? owner.confirmedPersonalInfo.fullName,
      email: profile.email ?? owner.confirmedPersonalInfo.email,
      phone: profile.phone ?? owner.confirmedPersonalInfo.phone,
      language: actualLocale ?? profile.language ?? owner.confirmedPersonalInfo.language,
    }
    owner.confirmedPersonalInfo = nextProfile
    setPersonalInfoState({ owner, value: nextProfile })
  }, [])

  const applyNotificationsForIdentity = useCallback((
    owner: SettingsIdentityLifecycle,
    preferences: Partial<NotificationPreferences>
  ) => {
    if (identityLifecycleRef.current !== owner) return

    const nextPreferences = {
      ...owner.confirmedNotifications,
      ...preferences,
    }
    owner.confirmedNotifications = nextPreferences
    setNotificationsState({ owner, value: nextPreferences })
  }, [])

  const refreshSessionBestEffort = useCallback(async () => {
    try {
      await refreshSession()
    } catch (error) {
      console.error('Failed to refresh session after settings update:', error)
    }
  }, [refreshSession])

  useEffect(() => {
    const owner = identityLifecycle
    const controller = new AbortController()
    owner.controllers.add(controller)
    const isCurrent = () =>
      identityLifecycleRef.current === owner && !controller.signal.aborted

    setPersonalInfoState({ owner, value: owner.confirmedPersonalInfo })
    setNotificationsState({ owner, value: owner.confirmedNotifications })
    setSecurityState({ owner, value: emptySecurityFields() })
    setLoadedIdentity(null)

    const loadData = async () => {
      if (!owner.key) {
        setLoadedIdentity(owner)
        return
      }

      let keepIdentityLoading = false

      try {
        const [profileRes, prefsRes] = await Promise.all([
          fetch('/api/user/profile', {
            headers: { 'X-CSP-Expected-User-Id': owner.userId! },
            signal: controller.signal,
          }),
          fetch('/api/user/preferences', {
            headers: { 'X-CSP-Expected-User-Id': owner.userId! },
            signal: controller.signal,
          }),
        ])

        if (!isCurrent()) return

        const [profileData, prefsData] = await Promise.all([
          profileRes.json().catch(() => null),
          prefsRes.json().catch(() => null),
        ])

        if (!isCurrent()) return

        const identityChanged = [
          { response: profileRes, data: profileData },
          { response: prefsRes, data: prefsData },
        ].some(({ response, data }) =>
          response.status === 409 &&
          (!data || data.error?.code === 'IDENTITY_CHANGED')
        )

        if (identityChanged) {
          keepIdentityLoading = true
          toast.warning(tToastRef.current('identityChanged'))
          await refreshSessionBestEffort()
          return
        }

        const loadedProfile = profileRes.ok && profileData?.success
          ? profileData.data?.profile
          : null
        const loadedPreferences = prefsRes.ok && prefsData?.success
          ? prefsData.data?.preferences
          : null

        if (!loadedProfile || !loadedPreferences) {
          keepIdentityLoading = true
          toast.error(tToastRef.current('updateFailed'))
          return
        }

        applyProfileForIdentity(owner, loadedProfile)
        applyNotificationsForIdentity(owner, loadedPreferences)
      } catch (error) {
        if (isCurrent()) {
          keepIdentityLoading = true
          console.error('Failed to load settings:', error)
          toast.error(tToastRef.current('updateFailed'))
          controller.abort()
        }
      } finally {
        owner.controllers.delete(controller)
        if (isCurrent() && !keepIdentityLoading) {
          setLoadedIdentity(owner)
        }
      }
    }

    void loadData()

    return () => {
      for (const activeController of owner.controllers) {
        activeController.abort()
      }
      owner.controllers.clear()
    }
  }, [
    applyNotificationsForIdentity,
    applyProfileForIdentity,
    identityLifecycle,
    refreshSessionBestEffort,
  ])

  const handleSavePersonalInfo = async () => {
    if (initialLoading || !identityLifecycle.userId) return

    const owner = identityLifecycle
    const token: SaveRequestToken = { owner }
    const controller = new AbortController()
    const submittedPersonalInfo = { ...personalInfo }
    const submittedProfileFields = getDirtyProfileFields(
      submittedPersonalInfo,
      owner.confirmedPersonalInfo
    )
    owner.controllers.add(controller)
    profileSaveTokenRef.current = token
    setLoadingProfileToken(token)

    const isCurrentRequest = () =>
      identityLifecycleRef.current === owner &&
      profileSaveTokenRef.current === token &&
      !controller.signal.aborted

    const reconcileUnconfirmedProfile = async () => {
      if (!isCurrentRequest()) return

      setPersonalInfoState({ owner, value: owner.confirmedPersonalInfo })
      toast.warning(tToast('outcomeUnconfirmed'))

      try {
        const profileRes = await fetch('/api/user/profile', {
          headers: { 'X-CSP-Expected-User-Id': owner.userId! },
          signal: controller.signal,
        })
        if (isCurrentRequest() && profileRes.ok) {
          const profileData = await profileRes.json()
          if (
            isCurrentRequest() &&
            profileData?.success &&
            profileData.data?.profile
          ) {
            applyProfileForIdentity(owner, profileData.data.profile)
          }
        }
      } catch (error) {
        if (isCurrentRequest()) {
          console.error('Failed to reconcile profile after an unconfirmed update:', error)
        }
      }

      if (isCurrentRequest()) {
        await refreshSessionBestEffort()
      }
    }

    try {
      let response: Response
      try {
        response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSP-Expected-User-Id': owner.userId!,
          },
          body: JSON.stringify(submittedProfileFields),
          signal: controller.signal,
        })
      } catch (error) {
        if (isCurrentRequest()) {
          console.error('Profile update outcome could not be confirmed:', error)
          await reconcileUnconfirmedProfile()
        }
        return
      }

      if (!isCurrentRequest()) return

      let data: SettingsMutationResponse
      try {
        const parsed = await response.json() as unknown
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Profile update response body was empty')
        }
        data = parsed as SettingsMutationResponse
      } catch (error) {
        if (!isCurrentRequest()) return

        console.error('Failed to parse profile update response:', error)
        if (response.status === 409) {
          toast.warning(tToast('identityChanged'))
          await refreshSessionBestEffort()
        } else if (response.status >= 500 || response.ok) {
          await reconcileUnconfirmedProfile()
        } else {
          toast.error(tToast('updateFailed'))
        }
        return
      }

      const explicitlyRejected =
        data.error?.code === 'PROFILE_REJECTED' ||
        data.error?.code === 'LOCALE_REJECTED'

      if (explicitlyRejected) {
        toast.error(data.error?.message || tToast('updateFailed'))
      } else if (response.status === 409 || data.error?.code === 'IDENTITY_CHANGED') {
        toast.warning(tToast('identityChanged'))
        await refreshSessionBestEffort()
      } else if (response.status >= 500) {
        await reconcileUnconfirmedProfile()
      } else if (!response.ok) {
        toast.error(data.error?.message || tToast('updateFailed'))
      } else if (data.success) {
        if (data.data?.profile) {
          applyProfileForIdentity(
            owner,
            data.data.profile,
            data.data.locale?.actual
          )
        } else {
          owner.confirmedPersonalInfo = submittedPersonalInfo
          setPersonalInfoState({ owner, value: submittedPersonalInfo })
        }

        if (data.data?.outcome === 'partial') {
          toast.warning(tToast('personalInfoPartiallyUpdated'))
        } else {
          toast.success(tToast('personalInfoUpdated'))
        }

        await refreshSessionBestEffort()
      } else if (data.error?.code === 'OUTCOME_UNCONFIRMED') {
        await reconcileUnconfirmedProfile()
      } else {
        toast.error(data.error?.message || tToast('updateFailed'))
      }
    } catch {
      if (isCurrentRequest()) {
        toast.error(tToast('updateFailed'))
      }
    } finally {
      owner.controllers.delete(controller)
      if (profileSaveTokenRef.current === token) {
        profileSaveTokenRef.current = null
        setLoadingProfileToken((current) => current === token ? null : current)
      }
    }
  }

  const handleSaveNotifications = async () => {
    if (initialLoading || !identityLifecycle.userId) return

    const owner = identityLifecycle
    const token: SaveRequestToken = { owner }
    const controller = new AbortController()
    const submittedNotifications = { ...notifications }
    const submittedNotificationFields = getDirtyNotificationFields(
      submittedNotifications,
      owner.confirmedNotifications
    )
    owner.controllers.add(controller)
    notificationsSaveTokenRef.current = token
    setLoadingNotificationsToken(token)

    const isCurrentRequest = () =>
      identityLifecycleRef.current === owner &&
      notificationsSaveTokenRef.current === token &&
      !controller.signal.aborted

    const reconcileUnconfirmedNotifications = async () => {
      if (!isCurrentRequest()) return

      setNotificationsState({ owner, value: owner.confirmedNotifications })
      toast.warning(tToast('outcomeUnconfirmed'))

      try {
        const prefsRes = await fetch('/api/user/preferences', {
          headers: { 'X-CSP-Expected-User-Id': owner.userId! },
          signal: controller.signal,
        })
        if (isCurrentRequest() && prefsRes.ok) {
          const prefsData = await prefsRes.json()
          if (
            isCurrentRequest() &&
            prefsData?.success &&
            prefsData.data?.preferences
          ) {
            applyNotificationsForIdentity(owner, prefsData.data.preferences)
          }
        }
      } catch (error) {
        if (isCurrentRequest()) {
          console.error('Failed to reconcile preferences after an unconfirmed update:', error)
        }
      }
    }

    try {
      let response: Response
      try {
        response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSP-Expected-User-Id': owner.userId!,
          },
          body: JSON.stringify(submittedNotificationFields),
          signal: controller.signal,
        })
      } catch (error) {
        if (isCurrentRequest()) {
          console.error('Preferences update outcome could not be confirmed:', error)
          await reconcileUnconfirmedNotifications()
        }
        return
      }

      if (!isCurrentRequest()) return

      let data: SettingsMutationResponse
      try {
        const parsed = await response.json() as unknown
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Preferences update response body was empty')
        }
        data = parsed as SettingsMutationResponse
      } catch (error) {
        if (!isCurrentRequest()) return

        console.error('Failed to parse preferences update response:', error)
        if (response.status === 409) {
          toast.warning(tToast('identityChanged'))
          await refreshSessionBestEffort()
        } else if (response.status >= 500 || response.ok) {
          await reconcileUnconfirmedNotifications()
        } else {
          toast.error(tToast('updateFailed'))
        }
        return
      }

      if (data.error?.code === 'PREFERENCES_REJECTED') {
        toast.error(data.error?.message || tToast('updateFailed'))
      } else if (response.status === 409 || data.error?.code === 'IDENTITY_CHANGED') {
        toast.warning(tToast('identityChanged'))
        await refreshSessionBestEffort()
      } else if (response.status >= 500) {
        await reconcileUnconfirmedNotifications()
      } else if (!response.ok) {
        toast.error(data.error?.message || tToast('updateFailed'))
      } else if (data.success) {
        applyNotificationsForIdentity(
          owner,
          data.data?.preferences ?? submittedNotificationFields
        )
        toast.success(tToast('notificationsUpdated'))
      } else if (data.error?.code === 'OUTCOME_UNCONFIRMED') {
        await reconcileUnconfirmedNotifications()
      } else {
        toast.error(data.error?.message || tToast('updateFailed'))
      }
    } catch {
      if (isCurrentRequest()) {
        toast.error(tToast('updateFailed'))
      }
    } finally {
      owner.controllers.delete(controller)
      if (notificationsSaveTokenRef.current === token) {
        notificationsSaveTokenRef.current = null
        setLoadingNotificationsToken((current) => current === token ? null : current)
      }
    }
  }

  const handleChangePassword = async () => {
    if (initialLoading || !identityLifecycle.userId) return

    if (security.newPassword !== security.confirmPassword) {
      toast.error(tToast('passwordMismatch'))
      return
    }

    if (security.newPassword.length < 8) {
      toast.error(tToast('passwordTooShort'))
      return
    }

    const owner = identityLifecycle
    const token: SaveRequestToken = { owner }
    const controller = new AbortController()
    const submittedSecurity = { ...security }
    owner.controllers.add(controller)
    passwordSaveTokenRef.current = token
    setLoadingPasswordToken(token)

    const isCurrentRequest = () =>
      identityLifecycleRef.current === owner &&
      passwordSaveTokenRef.current === token &&
      !controller.signal.aborted

    const handleUnconfirmedPassword = () => {
      if (!isCurrentRequest()) return

      setSecurityState({ owner, value: emptySecurityFields() })
      toast.warning(tToast('passwordOutcomeUnconfirmed'))
    }

    try {
      let response: Response
      try {
        response = await fetch('/api/user/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSP-Expected-User-Id': owner.userId!,
          },
          body: JSON.stringify({
            currentPassword: submittedSecurity.currentPassword,
            newPassword: submittedSecurity.newPassword,
            confirmPassword: submittedSecurity.confirmPassword,
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (isCurrentRequest()) {
          console.error('Password update outcome could not be confirmed:', error)
          handleUnconfirmedPassword()
        }
        return
      }

      if (!isCurrentRequest()) return

      let data: SettingsMutationResponse
      try {
        const parsed = await response.json() as unknown
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Password update response body was empty')
        }
        data = parsed as SettingsMutationResponse
      } catch (error) {
        if (!isCurrentRequest()) return

        console.error('Failed to parse password update response:', error)
        if (response.status === 409) {
          toast.warning(tToast('identityChanged'))
          await refreshSessionBestEffort()
        } else if (response.status >= 500 || response.ok) {
          handleUnconfirmedPassword()
        } else {
          toast.error(tToast('passwordUpdateFailed'))
        }
        return
      }

      const explicitlyRejected =
        data.error?.code === 'PASSWORD_REJECTED' ||
        data.error?.code === 'ACCOUNT_IDENTITY_MISMATCH' ||
        data.error?.code === 'CURRENT_PASSWORD_VERIFICATION_UNAVAILABLE' ||
        data.error?.code === 'PASSWORD_UPDATE_AUTHORIZATION_FAILED' ||
        data.error?.code === 'PASSWORD_UPDATE_REJECTED'

      if (explicitlyRejected) {
        toast.error(data.error?.message || tToast('passwordUpdateFailed'))
      } else if (response.status === 409 || data.error?.code === 'IDENTITY_CHANGED') {
        toast.warning(tToast('identityChanged'))
        await refreshSessionBestEffort()
      } else if (response.status >= 500) {
        handleUnconfirmedPassword()
      } else if (!response.ok) {
        if (data.error?.details?.[0]?.path?.includes('currentPassword')) {
          toast.error(tToast('incorrectPassword') || 'Current password is incorrect')
        } else {
          toast.error(data.error?.message || tToast('passwordUpdateFailed'))
        }
      } else if (data.success) {
        toast.success(tToast('passwordUpdated'))
        setSecurityState({ owner, value: emptySecurityFields() })
      } else if (data.error?.code === 'OUTCOME_UNCONFIRMED') {
        handleUnconfirmedPassword()
      } else if (data.error?.details?.[0]?.path?.includes('currentPassword')) {
        toast.error(tToast('incorrectPassword') || 'Current password is incorrect')
      } else {
        toast.error(data.error?.message || tToast('passwordUpdateFailed'))
      }
    } catch {
      if (isCurrentRequest()) {
        toast.error(tToast('passwordUpdateFailed'))
      }
    } finally {
      owner.controllers.delete(controller)
      if (passwordSaveTokenRef.current === token) {
        passwordSaveTokenRef.current = null
        setLoadingPasswordToken((current) => current === token ? null : current)
      }
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
                  disabled={initialLoading || loadingProfile}
                  onChange={(e) => setPersonalInfoState({
                    owner: identityLifecycle,
                    value: { ...personalInfo, fullName: e.target.value },
                  })}
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
                  disabled={initialLoading || loadingProfile}
                  onChange={(e) => setPersonalInfoState({
                    owner: identityLifecycle,
                    value: { ...personalInfo, phone: e.target.value },
                  })}
                  placeholder={tPersonal('phonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">{tPersonal('languageLabel')}</Label>
                <Select
                  value={personalInfo.language}
                  disabled={initialLoading || loadingProfile}
                  onValueChange={(value) => setPersonalInfoState({
                    owner: identityLifecycle,
                    value: { ...personalInfo, language: value },
                  })}
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

            <Button onClick={handleSavePersonalInfo} disabled={initialLoading || loadingProfile}>
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
                disabled={initialLoading || loadingNotifications}
                onCheckedChange={(checked) =>
                  setNotificationsState({
                    owner: identityLifecycle,
                    value: { ...notifications, emailNotifications: checked },
                  })
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
                disabled={initialLoading || loadingNotifications}
                onCheckedChange={(checked) =>
                  setNotificationsState({
                    owner: identityLifecycle,
                    value: { ...notifications, desktopNotifications: checked },
                  })
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
                disabled={initialLoading || loadingNotifications}
                onCheckedChange={(checked) =>
                  setNotificationsState({
                    owner: identityLifecycle,
                    value: { ...notifications, ticketUpdates: checked },
                  })
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
                disabled={initialLoading || loadingNotifications}
                onCheckedChange={(checked) =>
                  setNotificationsState({
                    owner: identityLifecycle,
                    value: { ...notifications, conversationReplies: checked },
                  })
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
                disabled={initialLoading || loadingNotifications}
                onCheckedChange={(checked) =>
                  setNotificationsState({
                    owner: identityLifecycle,
                    value: { ...notifications, promotions: checked },
                  })
                }
              />
            </div>

            <Button onClick={handleSaveNotifications} disabled={initialLoading || loadingNotifications}>
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
                disabled={initialLoading || loadingPassword}
                onChange={(e) => setSecurityState({
                  owner: identityLifecycle,
                  value: { ...security, currentPassword: e.target.value },
                })}
                placeholder={tSecurity('currentPasswordPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{tSecurity('newPasswordLabel')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={security.newPassword}
                disabled={initialLoading || loadingPassword}
                onChange={(e) => setSecurityState({
                  owner: identityLifecycle,
                  value: { ...security, newPassword: e.target.value },
                })}
                placeholder={tSecurity('newPasswordPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{tSecurity('confirmPasswordLabel')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={security.confirmPassword}
                disabled={initialLoading || loadingPassword}
                onChange={(e) => setSecurityState({
                  owner: identityLifecycle,
                  value: { ...security, confirmPassword: e.target.value },
                })}
                placeholder={tSecurity('confirmPasswordPlaceholder')}
              />
            </div>

            <Button onClick={handleChangePassword} disabled={initialLoading || loadingPassword}>
              {loadingPassword ? tSecurity('updating') : tSecurity('updatePassword')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

