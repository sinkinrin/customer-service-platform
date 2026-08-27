"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showBackground?: boolean
}

const sizeMap = {
  sm: { width: 66, height: 24 },
  md: { width: 99, height: 36 },
  lg: { width: 132, height: 48 },
}

/**
 * Logo Component
 * 
 * Displays the current HOWEN horizontal brand logo with configurable size.
 * `showBackground` keeps compatibility with callers that need a white logo plate.
 */
export function Logo({ className, size = "md", showBackground = false }: LogoProps) {
  const dimensions = sizeMap[size]

  return (
    <Image
      src="/透明-彩黑-大.png"
      alt="HOWEN Logo"
      width={dimensions.width}
      height={dimensions.height}
      className={cn(
        "flex-shrink-0 object-contain",
        showBackground && "rounded bg-white p-1",
        className
      )}
      priority
    />
  )
}

export default Logo
