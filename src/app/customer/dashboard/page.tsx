'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, FileText, HelpCircle, MessageCircle } from 'lucide-react'

export default function CustomerDashboardPage() {
  const router = useRouter()

  const quickActions = [
    {
      title: '在线咨询',
      description: '与客服进行实时对话',
      icon: MessageSquare,
      action: () => router.push('/customer/conversations'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: '知识库',
      description: '查找常见问题解答',
      icon: HelpCircle,
      action: () => router.push('/customer/faq'),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: '我的工单',
      description: '查看和管理工单',
      icon: FileText,
      action: () => router.push('/customer/my-tickets'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: '提交反馈',
      description: '分享您的建议和意见',
      icon: MessageCircle,
      action: () => router.push('/customer/feedback'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">客户服务中心</h1>
        <p className="text-muted-foreground mt-2">
          欢迎使用客户服务平台，我们随时为您提供帮助
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={action.action}
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <CardTitle className="text-lg">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>开始使用</CardTitle>
          <CardDescription>选择以下方式获取帮助</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0`}>
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">在线咨询</h3>
              <p className="text-sm text-muted-foreground mb-2">
                通过实时聊天获得即时帮助，我们的AI助手和人工客服随时为您服务
              </p>
              <Button onClick={() => router.push('/customer/conversations')} size="sm">
                开始对话
              </Button>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0`}>
              <HelpCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">浏览知识库</h3>
              <p className="text-sm text-muted-foreground mb-2">
                在知识库中搜索常见问题的答案，快速自助解决问题
              </p>
              <Button onClick={() => router.push('/customer/faq')} variant="outline" size="sm">
                浏览FAQ
              </Button>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0`}>
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">提交工单</h3>
              <p className="text-sm text-muted-foreground mb-2">
                需要详细记录问题？创建工单并跟踪处理进度
              </p>
              <Button onClick={() => router.push('/customer/my-tickets/create')} variant="outline" size="sm">
                创建工单
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
