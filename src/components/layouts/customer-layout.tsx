"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  HelpCircle,
  MessageSquare,
  FileText,
  MessageCircle,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { LanguageSelector } from "@/components/language-selector"
import { UnreadBadge } from "@/components/ui/unread-badge"

interface CustomerLayoutProps {
  children: ReactNode
  user?: {
    id: string
    email: string
    name?: string
    avatar?: string
    role?: string
  }
  onLogout?: () => void
}

interface NavItem {
  name: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
}

// Navigation items use translation keys
const getNavigation = (t: (key: string) => string): NavItem[] => [
  {
    name: t('helpCenter'),
    href: "/customer/faq",
    icon: HelpCircle,
  },
  {
    name: t('liveChat'),
    href: "/customer/conversations",
    icon: MessageSquare,
  },
  {
    name: t('ticketManagement'),
    icon: FileText,
    children: [
      { name: t('submitTicket'), href: "/customer/my-tickets/create", icon: FileText },
      { name: t('myTickets'), href: "/customer/my-tickets", icon: FileText },
    ],
  },
  {
    name: t('feedbackComplaints'),
    icon: MessageCircle,
    children: [
      { name: t('submitFeedback'), href: "/customer/feedback", icon: MessageCircle },
      { name: t('submitComplaint'), href: "/customer/complaints", icon: MessageCircle },
    ],
  },
]

export function CustomerLayout({ children, user, onLogout }: CustomerLayoutProps) {
  const t = useTranslations('auth.layout')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tSidebar = useTranslations('nav.customer')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get navigation with translated names
  const navigation = getNavigation(tSidebar)
  const [expandedItems, setExpandedItems] = useState<string[]>([tSidebar('ticketManagement'), tSidebar('feedbackComplaints')])
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()

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

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    )
  }

  const renderNavItem = (item: NavItem) => {
    const isExpanded = expandedItems.includes(item.name)
    const children = item.children ?? []
    const Icon = item.icon

    if (children.length > 0) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpanded(item.name)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {children.map((child) => {
                const ChildIcon = child.icon
                const isActive = pathname === child.href
                return (
                  <Link
                    key={child.href}
                    href={child.href || "#"}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <ChildIcon className="h-4 w-4" />
                    <span>{child.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    const isActive = pathname === item.href
    const isConversationsLink = item.href === "/customer/conversations"

    return (
      <Link
        key={item.href}
        href={item.href || "#"}
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
      </Link>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <Link href="/customer/dashboard" className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">{t('brandShort')}</span>
                </div>
                <span className="font-semibold text-lg hidden sm:inline-block">
                  {t('brandName')}
                </span>
              </Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              <LanguageSelector />
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar} alt={user.name || user.email} />
                        <AvatarFallback>
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name || "User"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/customer/dashboard">{tNav('dashboard')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/customer/settings">{tNav('settings')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout}>{tCommon('layout.signOut')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-background fixed left-0 top-16 bottom-0">
          <div className="mb-4 px-4 pt-6 flex-shrink-0">
            <h2 className="px-4 text-lg font-semibold">{tCommon('layout.customerService')}</h2>
          </div>
          <div className="flex-1 px-4 space-y-2 overflow-y-auto pb-24">
            {navigation.map(renderNavItem)}
          </div>
        </aside>

        {/* User Profile - Fixed at Bottom Left (Desktop) */}
        {user && (
          <div className="fixed bottom-0 left-0 w-64 p-4 bg-background border-t border-r z-50 hidden lg:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 hover:bg-accent">
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarImage src={user.avatar} alt={user.name || user.email} />
                    <AvatarFallback>
                      {user.name?.[0] || user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <p className="text-sm font-medium truncate w-full">
                      {user.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {user.email}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/customer/dashboard">{tNav('dashboard')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/customer/settings">{tNav('settings')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>{tCommon('layout.signOut')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-16 bottom-0 w-64 bg-background border-r">
              <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <div className="mb-4">
                  <h2 className="px-4 text-lg font-semibold">{tCommon('layout.customerService')}</h2>
                </div>
                {navigation.map(renderNavItem)}
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto lg:ml-64">
          <PageTransition key={pathname}>
            <div className="container mx-auto px-4 py-6">{children}</div>
          </PageTransition>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {tCommon('appName')}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default CustomerLayout

