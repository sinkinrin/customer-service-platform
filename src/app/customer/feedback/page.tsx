'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'

export default function FeedbackPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    category: 'feature',
    title: '',
    description: '',
    contact: user?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email) {
      toast.error('Please login to submit feedback')
      return
    }

    setLoading(true)

    try {
      // Create a ticket with "Feedback" tag
      const ticketData = {
        conversationId: crypto.randomUUID(),
        title: `[建议] ${formData.title}`,
        group: 'Support',
        customer: user.email,
        priority_id: 1, // Low priority for feedback
        article: {
          subject: formData.title,
          body: `类别: ${getCategoryLabel(formData.category)}\n\n${formData.description}\n\n联系方式: ${formData.contact}`,
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
        throw new Error(error.error || 'Failed to submit feedback')
      }

      toast.success('感谢您的建议！我们会认真考虑。')
      router.push('/customer/my-tickets')
    } catch (error: any) {
      console.error('Failed to submit feedback:', error)
      toast.error(error.message || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      feature: '功能建议',
      improvement: '改进建议',
      ui: '界面优化',
      other: '其他建议',
    }
    return labels[category] || category
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">提交建议</h1>
        </div>
        <p className="text-muted-foreground">
          您的建议对我们非常重要，帮助我们不断改进产品和服务
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>建议信息</CardTitle>
            <CardDescription>
              请详细描述您的建议，我们会认真评估并考虑实施
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">建议类别 *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="feature">功能建议</option>
                <option value="improvement">改进建议</option>
                <option value="ui">界面优化</option>
                <option value="other">其他建议</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">建议标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="简要概括您的建议"
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
                placeholder="请详细描述您的建议，包括：&#10;1. 建议的具体内容&#10;2. 为什么需要这个改进&#10;3. 预期的效果或好处"
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
              <Label htmlFor="contact">联系方式</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="邮箱或电话（可选）"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                如果我们需要进一步了解您的建议，可能会通过此方式联系您
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
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    提交建议
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Tips */}
      <Card className="mt-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">💡 提示</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>• 请尽可能详细地描述您的建议，这将帮助我们更好地理解您的需求</p>
          <p>• 如果您的建议涉及具体的功能或界面，可以提供截图或示例</p>
          <p>• 我们会定期评估所有建议，优先实施最有价值的改进</p>
          <p>• 您可以在&quot;我的工单&quot;中查看建议的处理进度</p>
        </CardContent>
      </Card>
    </div>
  )
}

