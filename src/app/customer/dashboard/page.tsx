"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationSummary } from '@/components/dashboard/conversation-summary'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquarePlus, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ConversationStats { total: number; waiting: number; active: number; closed: number }
interface Activity { id: string; type: 'message' | 'status_change' | 'assignment'; conversation_id: string; content?: string; status?: 'waiting' | 'active' | 'closed'; user?: { id: string; full_name: string; avatar_url?: string }; created_at: string }

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<ConversationStats>({ total: 0, waiting: 0, active: 0, closed: 0 })
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingActivities, setIsLoadingActivities] = useState(true)
  
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true)
      try {
        const response = await fetch('/api/conversations/stats')
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data.data)
      } catch (error) {
        console.error('Error fetching stats:', error)
        toast.error('Failed to load conversation statistics')
      } finally {
        setIsLoadingStats(false)
      }
    }
    fetchStats()
  }, [])
  
  useEffect(() => {
    const fetchActivities = async () => {
      setIsLoadingActivities(true)
      try {
        const response = await fetch('/api/conversations?limit=10')
        if (!response.ok) throw new Error('Failed to fetch conversations')
        const data = await response.json()
        const conversations = data.data?.conversations || []
        const recentActivities: Activity[] = conversations.map((conv: any) => ({
          id: conv.id,
          type: 'message' as const,
          conversation_id: conv.id,
          status: conv.status,
          user: conv.user_profiles,
          created_at: conv.last_message_at || conv.created_at,
        }))
        setActivities(recentActivities)
      } catch (error) {
        console.error('Error fetching activities:', error)
        toast.error('Failed to load recent activity')
      } finally {
        setIsLoadingActivities(false)
      }
    }
    fetchActivities()
  }, [])
  
  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your conversations</p>
      </div>
      <div className="mb-8">
        <ConversationSummary stats={stats} isLoading={isLoadingStats} />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <RecentActivity activities={activities} isLoading={isLoadingActivities} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Start a new conversation or browse help articles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={() => router.push('/conversations')}>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.push('/faq')}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Browse FAQ
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Our support team is here to help you with any questions or issues.</p>
              <Button variant="secondary" className="w-full" onClick={() => router.push('/faq')}>
                Visit Help Center
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>💡 Quick Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">You can search our FAQ for instant answers to common questions before starting a conversation.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

