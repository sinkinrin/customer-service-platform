"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  LayoutDashboard,
  Users,
  HelpCircle,
  Settings,
  Menu,
  X,
  LogOut,
  Activity,
  Ticket,
  ChevronDown,
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
import { Logo } from "@/components/ui/logo"

interface AdminLayoutProps {
  children: ReactNode
  user?: {
    id: string
    email: string
    name?: string
    avatar?: string
  }
  onLogout?: () => void
  systemStatus?: "healthy" | "warning" | "error"
}

export function AdminLayout({
  children,
  user,
  onLogout,
  systemStatus = "healthy",
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  const navigation = [
    {
      name: t('dashboard'),
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      name: t('users'),
      href: "/admin/users",
      icon: Users,
    },
    {
      name: t('tickets'),
      href: "/admin/tickets",
      icon: Ticket,
    },
    {
      name: t('faqManagement'),
      href: "/admin/faq",
      icon: HelpCircle,
    },
    {
      name: t('systemSettings'),
      href: "/admin/settings",
      icon: Settings,
    },
  ]

  const getStatusColor = () => {
    switch (systemStatus) {
      case "healthy":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = () => {
    switch (systemStatus) {
      case "healthy":
        return tCommon('status.allSystemsOperational')
      case "warning":
        return tCommon('status.minorIssuesDetected')
      case "error":
        return tCommon('status.systemError')
      default:
        return tCommon('status.unknownStatus')
    }
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

      {/* Sidebar - Fixed on all screen sizes */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b flex-shrink-0">
          <Link href="/admin" className="flex items-center space-x-2">
            <Logo size="md" />
            <span className="font-semibold">{tCommon('layout.adminPortal')}</span>
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

        {/* System Status */}
        <div className="px-4 py-4 border-b flex-shrink-0">
          <div className="flex items-center space-x-2 text-sm">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{tCommon('layout.systemStatus')}</span>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto pb-24">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
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
                    {user.name || tCommon('layout.administrator')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate w-full">
                    {tCommon('layout.administrator')}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
              <DropdownMenuLabel>{tCommon('layout.myAccount')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('settings')}
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

      {/* Main Content - Add left margin to account for fixed sidebar */}
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
                      <p className="text-sm font-medium">{user.name || tCommon('layout.administrator')}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      {t('settings')}
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
        <main className="flex-1 overflow-auto p-6">
          <PageTransition key={pathname}>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

