'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Save, CheckCircle2, XCircle, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'

type AIProvider = 'fastgpt' | 'openai' | 'yuxi-legacy'

interface AISettings {
  enabled: boolean
  provider: AIProvider
  // FastGPT
  fastgpt_url: string
  fastgpt_appid: string
  fastgpt_api_key: string
  // OpenAI
  openai_url: string
  openai_api_key: string
  openai_model: string
  // Yuxi Legacy
  yuxi_url: string
  yuxi_username: string
  yuxi_password: string
  yuxi_agent_id: string
  // Common
  model: string
  temperature: number
  system_prompt: string
}

const DEFAULT_SETTINGS: AISettings = {
  enabled: false,
  provider: 'fastgpt',
  fastgpt_url: '',
  fastgpt_appid: '',
  fastgpt_api_key: '',
  openai_url: '',
  openai_api_key: '',
  openai_model: '',
  yuxi_url: '',
  yuxi_username: '',
  yuxi_password: '',
  yuxi_agent_id: '',
  model: 'GPT-4o-mini',
  temperature: 0.7,
  system_prompt: 'You are a helpful customer service assistant.',
}

export default function SettingsPage() {
  const t = useTranslations('settings.ai')
  const tAdmin = useTranslations('admin.settings')
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_SETTINGS)
  const [aiLoading, setAILoading] = useState(true)
  const [aiSaving, setAISaving] = useState(false)

  const fetchAISettings = async () => {
    setAILoading(true)
    try {
      const response = await fetch('/api/admin/settings/ai')
      if (!response.ok) throw new Error(t('loadErrorGeneral'))

      const data = await response.json()
      setAISettings({ ...DEFAULT_SETTINGS, ...data.data })
    } catch (error) {
      toast.error(t('loadError'))
      console.error(error)
    } finally {
      setAILoading(false)
    }
  }

  const saveAISettings = async () => {
    setAISaving(true)
    try {
      const response = await fetch('/api/admin/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiSettings),
      })

      if (!response.ok) throw new Error(t('saveError'))

      toast.success(t('saveSuccess'))
    } catch (error) {
      toast.error(t('saveError'))
      console.error(error)
    } finally {
      setAISaving(false)
    }
  }

  useEffect(() => {
    fetchAISettings()
  }, [])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tAdmin('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {tAdmin('pageDescription')}
        </p>
      </div>

      {/* AI Auto-Reply Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-enabled" className="text-base">
                    {t('enableLabel')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('enableHint')}
                  </p>
                </div>
                <Switch
                  id="ai-enabled"
                  checked={aiSettings.enabled}
                  onCheckedChange={(checked) =>
                    setAISettings({ ...aiSettings, enabled: checked })
                  }
                />
              </div>

              {aiSettings.enabled && (
                <>
                  {/* Provider Selection */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="space-y-3">
                      <Label className="text-base">{t('provider.label')}</Label>
                      <RadioGroup
                        value={aiSettings.provider}
                        onValueChange={(value) =>
                          setAISettings({ ...aiSettings, provider: value as AIProvider })
                        }
                        className="flex flex-col sm:flex-row gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fastgpt" id="provider-fastgpt" />
                          <Label htmlFor="provider-fastgpt" className="cursor-pointer">
                            {t('provider.fastgpt')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="openai" id="provider-openai" />
                          <Label htmlFor="provider-openai" className="cursor-pointer">
                            {t('provider.openai')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yuxi-legacy" id="provider-yuxi" />
                          <Label htmlFor="provider-yuxi" className="cursor-pointer">
                            {t('provider.yuxiLegacy')}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* FastGPT Configuration */}
                  {aiSettings.provider === 'fastgpt' && (
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-medium">{t('fastgpt.title')}</h3>

                      <div className="space-y-2">
                        <Label htmlFor="fastgpt-url">{t('fastgpt.url')}</Label>
                        <Input
                          id="fastgpt-url"
                          value={aiSettings.fastgpt_url}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, fastgpt_url: e.target.value })
                          }
                          placeholder="https://your-fastgpt-instance.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('fastgpt.urlHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fastgpt-appid">{t('fastgpt.appId')}</Label>
                        <Input
                          id="fastgpt-appid"
                          value={aiSettings.fastgpt_appid}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, fastgpt_appid: e.target.value })
                          }
                          placeholder="your-app-id"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('fastgpt.appIdHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fastgpt-api-key">{t('fastgpt.apiKey')}</Label>
                        <Input
                          id="fastgpt-api-key"
                          type="password"
                          value={aiSettings.fastgpt_api_key}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, fastgpt_api_key: e.target.value })
                          }
                          placeholder="fastgpt-xxxxxx"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('fastgpt.apiKeyHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* OpenAI Compatible Configuration */}
                  {aiSettings.provider === 'openai' && (
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-medium">{t('openai.title')}</h3>

                      <div className="space-y-2">
                        <Label htmlFor="openai-url">{t('openai.url')}</Label>
                        <Input
                          id="openai-url"
                          value={aiSettings.openai_url}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, openai_url: e.target.value })
                          }
                          placeholder="https://api.openai.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('openai.urlHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="openai-api-key">{t('openai.apiKey')}</Label>
                        <Input
                          id="openai-api-key"
                          type="password"
                          value={aiSettings.openai_api_key}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, openai_api_key: e.target.value })
                          }
                          placeholder="sk-xxxxxx"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('openai.apiKeyHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="openai-model">{t('openai.model')}</Label>
                        <Input
                          id="openai-model"
                          value={aiSettings.openai_model}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, openai_model: e.target.value })
                          }
                          placeholder="gpt-4o-mini"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('openai.modelHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Yuxi-Know Legacy Configuration */}
                  {aiSettings.provider === 'yuxi-legacy' && (
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="text-sm font-medium">{t('yuxiLegacy.title')}</h3>

                      <div className="space-y-2">
                        <Label htmlFor="yuxi-url">{t('yuxiLegacy.url')}</Label>
                        <Input
                          id="yuxi-url"
                          value={aiSettings.yuxi_url}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, yuxi_url: e.target.value })
                          }
                          placeholder="https://yuxi.example.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('yuxiLegacy.urlHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="yuxi-username">{t('yuxiLegacy.username')}</Label>
                        <Input
                          id="yuxi-username"
                          value={aiSettings.yuxi_username}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, yuxi_username: e.target.value })
                          }
                          placeholder="admin"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('yuxiLegacy.usernameHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="yuxi-password">{t('yuxiLegacy.password')}</Label>
                        <Input
                          id="yuxi-password"
                          type="password"
                          value={aiSettings.yuxi_password}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, yuxi_password: e.target.value })
                          }
                          placeholder="********"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('yuxiLegacy.passwordHint')}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="yuxi-agent-id">{t('yuxiLegacy.agentId')}</Label>
                        <Input
                          id="yuxi-agent-id"
                          value={aiSettings.yuxi_agent_id}
                          onChange={(e) =>
                            setAISettings({ ...aiSettings, yuxi_agent_id: e.target.value })
                          }
                          placeholder="chatbot"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('yuxiLegacy.agentIdHint')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Test Connection Button */}
                  <div className="border-t pt-4">
                    <TestConnectionButton aiSettings={aiSettings} />
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={saveAISettings} disabled={aiSaving}>
                  {aiSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('save.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t('save.label')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Test Connection Button Component
 */
function TestConnectionButton({ aiSettings }: { aiSettings: AISettings }) {
  const t = useTranslations('settings.ai.test')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: string
    responseTime?: number
    provider?: string
  } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      setTestResult({
        success: data.success,
        message: data.success ? t('resultSuccess') : t('resultFail'),
        details: data.error,
        responseTime: data.responseTime,
        provider: data.provider,
      })

      if (data.success) {
        toast.success(t('success'))
      } else {
        toast.error(data.error || t('error'))
      }
    } catch (error: unknown) {
      const err = error as Error
      console.error('Test connection error:', err)
      setTestResult({
        success: false,
        message: t('genericError'),
        details: err.message || t('networkError'),
      })
      toast.error(t('genericError'))
    } finally {
      setTesting(false)
    }
  }

  const canTest = aiSettings.enabled && (
    (aiSettings.provider === 'fastgpt' && aiSettings.fastgpt_url && aiSettings.fastgpt_api_key) ||
    (aiSettings.provider === 'openai' && aiSettings.openai_url && aiSettings.openai_api_key && aiSettings.openai_model) ||
    (aiSettings.provider === 'yuxi-legacy' && aiSettings.yuxi_url && aiSettings.yuxi_username && aiSettings.yuxi_password && aiSettings.yuxi_agent_id)
  )

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        onClick={handleTest}
        disabled={!canTest || testing}
        className="w-full"
      >
        {testing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('testing')}
          </>
        ) : (
          <>
            <Wifi className="mr-2 h-4 w-4" />
            {t('label')}
          </>
        )}
      </Button>

      {!canTest && (
        <p className="text-xs text-muted-foreground">
          {t('missingConfig')}
        </p>
      )}

      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}>
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 space-y-2">
              <AlertDescription>
                <div className="font-medium">
                  {testResult.message}
                </div>
                {testResult.provider && (
                  <div className="text-sm mt-1 opacity-90">
                    Provider: {testResult.provider}
                  </div>
                )}
                {testResult.details && (
                  <div className="text-sm mt-1 opacity-90">
                    {testResult.details}
                  </div>
                )}
                {testResult.responseTime !== undefined && (
                  <div className="text-sm mt-1 opacity-90">
                    {t('responseTime', { ms: testResult.responseTime })}
                  </div>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}
    </div>
  )
}
