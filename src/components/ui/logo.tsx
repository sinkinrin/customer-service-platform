"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showBackground?: boolean
}

const sizeMap = {
  sm: { width: 24, height: 24 },
  md: { width: 32, height: 32 },
  lg: { width: 48, height: 48 },
}

/**
 * Logo Component
 * 
 * Displays the HOWEN logo with configurable size and background.
 * - `showBackground`: Use the version with white circular background (for light themes/favicon)
 * - Default: Use the transparent version (for dashboard sidebars)
 */
export function Logo({ className, size = "md", showBackground = false }: LogoProps) {
  const dimensions = sizeMap[size]
  const src = showBackground ? "/logo-with-bg.svg" : "/logo.svg"

  return (
    <Image
      src={src}
      alt="HOWEN Logo"
      width={dimensions.width}
      height={dimensions.height}
      className={cn("flex-shrink-0", className)}
      priority
    />
  )
}

export default Logo
