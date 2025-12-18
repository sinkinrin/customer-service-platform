/**
 * Login Page
 *
 * User login with email and password using mock authentication
 */

"use client"

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/hooks/use-auth'
import { getDefaultRouteForRole, type UserRole } from '@/lib/utils/route-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { signIn, user, userRole } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Auto-redirect authenticated users to their dashboard
  // Combined logic: handles both role-based redirect and dev environment email shortcuts
  useEffect(() => {
    if (!user) return

    // If we have userRole, use it for redirect
    if (userRole) {
      const target = getDefaultRouteForRole(userRole as UserRole)
      router.replace(target)
      return
    }

    // Dev environment fallback: infer role from test user emails when userRole isn't yet available
    if (process.env.NODE_ENV !== 'production') {
      const email = user.email?.toLowerCase()
      if (email === 'admin@test.com') { router.replace('/admin/dashboard'); return }
      if (email === 'staff@test.com') { router.replace('/staff/dashboard'); return }
      if (email === 'customer@test.com') { router.replace('/customer/dashboard'); return }
    }
  }, [user, userRole, router])

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true)
      setError(null)

      const { data: authData, error } = await signIn(data.email, data.password)

      if (error) {
        setError(error.message || 'Failed to sign in')
        return
      }

      // Validate session data
      if (!authData?.user) {
        setError('Login failed: no session returned')
        return
      }

      // Use the fresh role from signIn response to avoid stale cached role
      const role = authData.user.role
      const defaultRoute = getDefaultRouteForRole(role)
      router.replace(defaultRoute)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Don't render login form if user is already authenticated (will redirect via useEffect)
  if (user && userRole) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t('loginPage.redirecting')}</CardTitle>
          <CardDescription>
            {t('loginPage.redirectingDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">{t('loginPage.title')}</CardTitle>
        <CardDescription>
          {t('loginPage.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('loginPage.emailPlaceholder')}
              data-testid="login-email-input"
              {...register('email')}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-destructive" data-testid="login-email-error">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('password')}</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t('loginPage.passwordPlaceholder')}
                data-testid="login-password-input"
                className="pr-10"
                {...register('password')}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive" data-testid="login-password-error">{errors.password.message}</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md" data-testid="login-error-message">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="login-submit-button"
          >
            {isSubmitting ? t('loggingIn') : t('loginButton')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/auth/register" className="text-primary hover:underline font-medium">
            {t('registerButton')}
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

