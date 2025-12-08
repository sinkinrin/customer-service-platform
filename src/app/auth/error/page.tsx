/**
 * Auth Error Page
 *
 * Styled error page for authentication failures
 * Uses the shared auth layout for consistent look and feel
 */

import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ErrorPageProps {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const t = await getTranslations("auth.error")
  const { error } = await searchParams
  const errorCode = error || "default"

  const errorMessage =
    errorCode === "AUTH_CONFIG_MISSING"
      ? t("configMissing", {
          defaultMessage:
            "Authentication is not configured. Please contact support or set AUTH_DEFAULT_USER_* env variables.",
        })
      : errorCode === "CredentialsSignin"
        ? t("invalidCredentials", { defaultMessage: "Invalid email or password." })
        : t("default", { defaultMessage: "Authentication failed. Please try again." })

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <CardTitle className="text-xl">{t("title", { defaultMessage: "Login error" })}</CardTitle>
        </div>
        <CardDescription>{t("description", { defaultMessage: "Something went wrong while signing you in." })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{errorMessage}</p>
        <p className="text-xs text-muted-foreground break-all">
          {t("errorCode", { defaultMessage: "Error code" })}: {errorCode}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="default">
          <Link href="/auth/login" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("backToLogin", { defaultMessage: "Back to login" })}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
