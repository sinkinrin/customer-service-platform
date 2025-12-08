"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  MessageSquare,
  Ticket,
  Users,
  Settings,
  Menu,
  X,
  Bell,
  LogOut,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageTransition } from "@/components/ui/page-transition"
import { cn } from "@/lib/utils"
import { UnreadBadge } from "@/components/ui/unread-badge"
import { getRegionLabel, type RegionValue } from "@/lib/constants/regions"

interface StaffLayoutProps {
  children: ReactNode
  user?: {
    id: string
    email: string
    name?: string
    avatar?: string
    role?: string
    region?: string
  }
  onLogout?: () => void
  conversationCount?: number
  ticketCount?: number
}

export function StaffLayout({
  children,
  user,
  onLogout,
  conversationCount = 0,
  ticketCount = 0,
}: StaffLayoutProps) {
  const t = useTranslations('auth.layout')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()

  const navigation = [
    {
      name: tNav('conversations'),
      href: "/staff/conversations",
      icon: MessageSquare,
      badge: "conversationCount",
    },
    {
      name: tNav('tickets'),
      href: "/staff/tickets",
      icon: Ticket,
      badge: "ticketCount",
    },
    {
      name: tNav('customers'),
      href: "/staff/customers",
      icon: Users,
    },
    {
      name: tNav('settings'),
      href: "/staff/settings",
      icon: Settings,
    },
  ]

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/conversations/unread-count')
        const data = await response.json()
        if (data.success) {
          setUnreadCount(data.data.unreadCount || 0)
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error)
      }
    }

    fetchUnreadCount()

    // Refresh unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const getBadgeCount = (badgeKey?: string) => {
    if (badgeKey === "conversationCount") return unreadCount > 0 ? unreadCount : conversationCount
    if (badgeKey === "ticketCount") return ticketCount
    return 0
  }

  return (
    <div className="min-h-screen flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b flex-shrink-0">
          <Link href="/staff" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">{t('brandShort')}</span>
            </div>
            <span className="font-semibold">{tCommon('layout.staffPortal')}</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto pb-24">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const badgeCount = getBadgeCount(item.badge)
            const Icon = item.icon
            const isConversationsLink = item.href === "/staff/conversations"

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </div>
                {isConversationsLink && unreadCount > 0 && (
                  <UnreadBadge count={unreadCount} dotOnly className="absolute top-2 right-2" />
                )}
                {!isConversationsLink && badgeCount > 0 && (
                  <Badge variant={isActive ? "secondary" : "default"} className="ml-auto">
                    {badgeCount}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* User Profile - Fixed at Bottom Left */}
      {user && (
        <div className="fixed bottom-0 left-0 w-64 p-4 bg-card border-t border-r z-50 hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2 hover:bg-accent">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={user.avatar} alt={user.name || user.email} />
                  <AvatarFallback>
                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <p className="text-sm font-medium truncate w-full">
                    {user.name || "Staff"}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {user.region && (
                      <>
                        <Globe className="h-3 w-3" />
                        <span className="truncate">
                          {getRegionLabel(user.region as RegionValue, 'zh').split(' ')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
              <DropdownMenuLabel>{tCommon('layout.myAccount')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/staff/profile">{tCommon('layout.profileSettings')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/staff/settings">{tCommon('layout.preferences')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {tCommon('layout.logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b bg-background flex items-center justify-between px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {(conversationCount + ticketCount) > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <PageTransition key={pathname}>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

export default StaffLayout

