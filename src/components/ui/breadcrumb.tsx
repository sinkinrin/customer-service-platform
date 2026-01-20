"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Home, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: LucideIcon
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center text-sm text-muted-foreground", className)}
    >
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const Icon = item.icon

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
              )}
              {isLast ? (
                <span
                  className="flex items-center gap-1.5 font-medium text-foreground"
                  aria-current="page"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Home as HomeIcon }
