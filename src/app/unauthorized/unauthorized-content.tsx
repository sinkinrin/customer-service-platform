"use client"

/**
 * Unauthorized Content (Client Component)
 *
 * Client-side component for the unauthorized page with navigation support.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ShieldX, ArrowLeft, Home } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface UnauthorizedContentProps {
  userRole: "customer" | "staff" | "admin" | null
}

export function UnauthorizedContent({ userRole }: UnauthorizedContentProps) {
  const t = useTranslations("auth.accessDenied")
  const router = useRouter()

  // Determine the appropriate dashboard based on role
  const getDashboardUrl = () => {
    switch (userRole) {
      case "admin":
        return "/admin/dashboard"
      case "staff":
        return "/staff/dashboard"
      case "customer":
        return "/customer/dashboard"
      default:
        return "/auth/login"
    }
  }

  const handleGoBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldX className="h-6 w-6" />
            <CardTitle className="text-xl">{t("title")}</CardTitle>
          </div>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userRole && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                {t("yourRole")}{" "}
                <span className="font-medium text-foreground capitalize">{userRole}</span>
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleGoBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("goBack")}
          </Button>
          <Button asChild variant="default" className="flex-1">
            <Link href={getDashboardUrl()} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
