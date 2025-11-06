'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, FileText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { PRODUCT_CATEGORIES } from '@/lib/constants/products'

export default function CreateTicketPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    category: '',
    model: '',
    priority: '2', // Medium
    title: '',
    description: '',
  })

  const [files, setFiles] = useState<File[]>([])

  const selectedCategory = PRODUCT_CATEGORIES.find(c => c.name === formData.category)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    
    // Validate file count
    if (files.length + selectedFiles.length > 5) {
      toast.error('最多只能上传 5 个附件')
      return
    }

    // Validate file size (512MB each)
    const maxSize = 512 * 1024 * 1024
    const invalidFiles = selectedFiles.filter(f => f.size > maxSize)
    if (invalidFiles.length > 0) {
      toast.error('单个文件大小不能超过 512MB')
      return
    }

    setFiles([...files, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email) {
      toast.error('Please login to create a ticket')
      return
    }

    if (!formData.category || !formData.model) {
      toast.error('请选择产品分类和型号')
      return
    }

    setLoading(true)

    try {
      // Create ticket data (matching API schema)
      const ticketData = {
        title: formData.title,
        group: 'Support',
        priority_id: parseInt(formData.priority),
        article: {
          subject: formData.title,
          body: `产品分类: ${formData.category}\n产品型号: ${formData.model}\n\n${formData.description}`,
          type: 'web' as const,
          internal: false,
        },
      }

      // TODO: Handle file attachments
      // Zammad API supports attachments, but we need to implement file upload

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create ticket')
      }

      const result = await response.json()
      toast.success('工单创建成功！')
      router.push(`/my-tickets/${result.data.ticket.id}`)
    } catch (error: any) {
      console.error('Failed to create ticket:', error)
      toast.error(error.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      '1': '低 - 产品使用咨询',
      '2': '中 - 一般问题',
      '3': '高 - 业务受损',
      '4': '紧急 - 业务不可用',
    }
    return labels[priority] || priority
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">提交工单</h1>
        </div>
        <p className="text-muted-foreground">
          遇到问题？提交工单，我们的技术支持团队会尽快为您解决
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>工单信息</CardTitle>
            <CardDescription>
              请详细描述您遇到的问题，以便我们更快地为您解决
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">产品分类 *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, model: '' })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">请选择产品分类</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">产品型号 *</Label>
                <select
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                  disabled={!formData.category}
                >
                  <option value="">请选择产品型号</option>
                  {selectedCategory?.models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">紧急程度 *</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="1">{getPriorityLabel('1')}</option>
                <option value="2">{getPriorityLabel('2')}</option>
                <option value="3">{getPriorityLabel('3')}</option>
                <option value="4">{getPriorityLabel('4')}</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">问题标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="简要描述您的问题"
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/200 字符
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">问题描述 *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请详细描述您遇到的问题，包括：&#10;1. 问题发生的时间和频率&#10;2. 具体的错误信息或现象&#10;3. 您已经尝试过的解决方法&#10;4. 问题对您业务的影响"
                rows={8}
                required
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/1200 字符
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="files">附件（可选）</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="files"
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('files')?.click()}
                    disabled={files.length >= 5}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    选择文件
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    最多 5 个文件，单个文件 ≤ 512MB
                  </span>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground mx-2">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                    提交工单
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
          <p>• 请尽可能详细地描述问题，包括截图、日志等信息</p>
          <p>• 紧急问题会优先处理，我们承诺在 2 小时内响应</p>
          <p>• 您可以在&quot;我的工单&quot;中查看工单处理进度</p>
          <p>• 如需紧急支持，请选择&quot;紧急 - 业务不可用&quot;优先级</p>
        </CardContent>
      </Card>
    </div>
  )
}

