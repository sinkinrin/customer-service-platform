'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Save, CheckCircle2, XCircle, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'

interface BusinessType {
  id: string
  name: string
  description?: string
  created_at: string
}

interface Settings {
  businessTypes: BusinessType[]
}

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
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
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

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) throw new Error('Failed to fetch settings')

      const data = await response.json()
      setSettings(data)
    } catch (error) {
      toast.error('Failed to load settings')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

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
    fetchSettings()
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
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">{t('modelLabel')}</Label>
                    <Input
                      id="ai-model"
                      value={aiSettings.model}
                      onChange={(e) =>
                        setAISettings({ ...aiSettings, model: e.target.value })
                      }
                      placeholder="gpt-3.5-turbo"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('modelHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-temperature">{t('temperatureLabel')}</Label>
                    <Input
                      id="ai-temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiSettings.temperature}
                      onChange={(e) =>
                        setAISettings({
                          ...aiSettings,
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('temperatureHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-prompt">{t('promptLabel')}</Label>
                    <Textarea
                      id="ai-prompt"
                      value={aiSettings.system_prompt}
                      onChange={(e) =>
                        setAISettings({ ...aiSettings, system_prompt: e.target.value })
                      }
                      rows={4}
                      placeholder={t('promptPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('promptHint')}
                    </p>
                  </div>

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

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Business Types</CardTitle>
              <CardDescription>
                Manage business types for conversation categorization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settings?.businessTypes && settings.businessTypes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.businessTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.description || '-'}</TableCell>
                        <TableCell>
                          {new Date(type.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No business types configured
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                General system settings and parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">Default Language</p>
                    <p className="text-sm text-muted-foreground">
                      Default language for new users
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">
                      User session timeout duration
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Configure email notification settings
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
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
