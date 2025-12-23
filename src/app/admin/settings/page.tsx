'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
// Table and Textarea imports removed - no longer needed
import { Loader2, Save, CheckCircle2, XCircle, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'

interface AISettings {
  enabled: boolean
  model: string
  temperature: number
  system_prompt: string
  fastgpt_url: string
  fastgpt_appid: string
  fastgpt_api_key: string
}

export default function SettingsPage() {
  const t = useTranslations('settings.ai')
  const [aiSettings, setAISettings] = useState<AISettings>({
    enabled: false,
    model: 'GPT-4o-mini',
    temperature: 0.7,
    system_prompt: 'You are a helpful customer service assistant.',
    fastgpt_url: '',
    fastgpt_appid: '',
    fastgpt_api_key: '',
  })
  const [aiLoading, setAILoading] = useState(true)
  const [aiSaving, setAISaving] = useState(false)

  const fetchAISettings = async () => {
    setAILoading(true)
    try {
      const response = await fetch('/api/admin/settings/ai')
      if (!response.ok) throw new Error(t('loadErrorGeneral'))

      const data = await response.json()
      setAISettings(data.data)
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
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage system settings and configurations
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
                  {/* AI model, temperature, system prompt removed - configured in FastGPT */}
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

                    {/* Test Connection Button */}
                    <div className="pt-4">
                      <TestConnectionButton aiSettings={aiSettings} />
                    </div>
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

      {/* Business Types and System Configuration sections removed - not needed for this system */}
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
    testResponse?: string
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
      setTestResult(data)

      if (data.success) {
        toast.success(t('success'))
      } else {
        toast.error(data.error || t('error'))
      }
    } catch (error: any) {
      console.error('Test connection error:', error)
      setTestResult({
        success: false,
        message: t('genericError'),
        details: error.message || t('networkError')
      })
      toast.error(t('genericError'))
    } finally {
      setTesting(false)
    }
  }

  const canTest = aiSettings.enabled &&
                  aiSettings.fastgpt_url &&
                  aiSettings.fastgpt_appid &&
                  aiSettings.fastgpt_api_key

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
                  {testResult.success ? t('resultSuccess') : t('resultFail')}
                </div>
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
                {testResult.testResponse && (
                  <div className="text-sm mt-2 p-2 bg-muted rounded">
                    <div className="font-medium mb-1">{t('testReply')}</div>
                    <div className="opacity-90">{testResult.testResponse}</div>
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
