"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Ticket,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  Globe,
  ChevronDown,
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
import { isValidRegion, type RegionValue } from "@/lib/constants/regions"
import { LanguageSelector } from "@/components/language-selector"
import { Logo } from "@/components/ui/logo"
import { NotificationCenter } from "@/components/notification/notification-center"
import { useNotifications } from "@/lib/hooks/use-notifications"

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
  ticketCount?: number
}

export function StaffLayout({
  children,
  user,
  onLogout,
  ticketCount = 0,
}: StaffLayoutProps) {
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tRegions = useTranslations('common.regions')
  const tRoles = useTranslations('common.roles')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { unreadCount } = useNotifications({ enabled: !!user })

  // Matches /staff/tickets/123
  const isTicketDetailPage = /^\/staff\/tickets\/\d+$/.test(pathname)

  const navigation = [
    {
      name: tNav('tickets'),
      href: "/staff/tickets",
      icon: Ticket,
      badge: "unreadCount",
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

  const getBadgeCount = (badgeKey?: string): number | string => {
    if (badgeKey === "ticketCount") return ticketCount
    if (badgeKey === "unreadCount") {
      return unreadCount > 99 ? '99+' : unreadCount
    }
    return 0
  }

  return (
    <div className={cn('flex bg-background', isTicketDetailPage ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}>
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:z-40 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b flex-shrink-0">
          <Link href="/staff" className="flex items-center space-x-2">
            <Logo size="md" />
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
                {(typeof badgeCount === 'string' || badgeCount > 0) && (
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
        <div className="fixed bottom-0 left-0 w-64 bg-card border-t border-r z-50 hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full h-auto justify-start p-4 rounded-none hover:bg-accent group">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={user.avatar} alt={user.name || user.email} />
                  <AvatarFallback>
                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <p className="text-sm font-medium truncate w-full">
                    {user.name || tRoles('staff')}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {user.region && (
                      <>
                        <Globe className="h-3 w-3" />
                        <span className="truncate">
                          {isValidRegion(user.region)
                            ? tRegions(user.region as RegionValue)
                            : user.region}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
              <DropdownMenuLabel>{tCommon('layout.myAccount')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/staff/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {tNav('settings')}
                </Link>
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
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
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

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            <NotificationCenter />
            <LanguageSelector />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name || user.email} />
                      <AvatarFallback>
                        {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.name || tRoles('staff')}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/staff/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      {tNav('settings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {tCommon('layout.logOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className={cn('flex-1 flex flex-col min-h-0 p-6', isTicketDetailPage ? 'overflow-hidden' : 'overflow-auto')}>
          <PageTransition
            key={pathname}
            className={cn(isTicketDetailPage && 'flex-1 flex flex-col min-h-0 overflow-hidden')}
          >
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

export default StaffLayout
