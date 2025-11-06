'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'

export default function ComplaintsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    category: 'service',
    severity: '2', // Medium
    title: '',
    description: '',
    contact: user?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email) {
      toast.error('Please login to submit a complaint')
      return
    }

    setLoading(true)

    try {
      // Create a ticket with "Complaint" tag and higher priority
      const ticketData = {
        conversationId: crypto.randomUUID(),
        title: `[投诉] ${formData.title}`,
        group: 'Support',
        customer: user.email,
        priority_id: parseInt(formData.severity), // Use severity as priority
        article: {
          subject: formData.title,
          body: `类别: ${getCategoryLabel(formData.category)}\n严重程度: ${getSeverityLabel(formData.severity)}\n\n${formData.description}\n\n联系方式: ${formData.contact}`,
          type: 'web' as const,
          internal: false,
        },
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit complaint')
      }

      toast.success('您的投诉已提交，我们会尽快处理。')
      router.push('/my-tickets')
    } catch (error: any) {
      console.error('Failed to submit complaint:', error)
      toast.error(error.message || 'Failed to submit complaint')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      service: '服务质量',
      product: '产品质量',
      delivery: '交付问题',
      billing: '计费问题',
      other: '其他投诉',
    }
    return labels[category] || category
  }

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      '1': '低',
      '2': '中',
      '3': '高',
      '4': '紧急',
    }
    return labels[severity] || severity
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h1 className="text-3xl font-bold">提交投诉</h1>
        </div>
        <p className="text-muted-foreground">
          我们重视每一位客户的反馈，您的投诉将得到认真对待和及时处理
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>投诉信息</CardTitle>
            <CardDescription>
              请详细描述您的投诉内容，我们会尽快调查并给予回复
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">投诉类别 *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="service">服务质量</option>
                <option value="product">产品质量</option>
                <option value="delivery">交付问题</option>
                <option value="billing">计费问题</option>
                <option value="other">其他投诉</option>
              </select>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label htmlFor="severity">严重程度 *</Label>
              <select
                id="severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="1">低 - 轻微不满</option>
                <option value="2">中 - 一般问题</option>
                <option value="3">高 - 严重影响</option>
                <option value="4">紧急 - 重大损失</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">投诉标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="简要概括您的投诉"
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/200 字符
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">详细描述 *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请详细描述投诉内容，包括：&#10;1. 问题发生的时间和地点&#10;2. 涉及的人员或产品&#10;3. 具体的问题和影响&#10;4. 您期望的解决方案"
                rows={8}
                required
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/1200 字符
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="contact">联系方式 *</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="邮箱或电话"
                required
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                我们会通过此方式与您联系，跟进投诉处理进度
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                取消
              </Button>
              <Button type="submit" disabled={loading} variant="destructive">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    提交投诉
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Warning */}
      <Card className="mt-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="text-red-900 dark:text-red-100">⚠️ 重要提示</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-800 dark:text-red-200 space-y-2">
          <p>• 请确保提供的信息真实准确，以便我们更好地处理您的投诉</p>
          <p>• 我们承诺在收到投诉后 24 小时内给予初步回复</p>
          <p>• 对于紧急投诉，我们会优先处理并尽快解决</p>
          <p>• 您可以在&quot;我的工单&quot;中查看投诉的处理进度和回复</p>
          <p>• 如有任何疑问，请随时通过在线咨询联系我们</p>
        </CardContent>
      </Card>
    </div>
  )
}

