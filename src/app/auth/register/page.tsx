/**
 * Register Page
 * 
 * PUBLIC REGISTRATION IS DISABLED
 * Users must be created by administrators through the Admin Panel
 */

"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <CardTitle className="text-2xl font-bold">Registration Disabled</CardTitle>
        </div>
        <CardDescription>
          Public registration is not available for this system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Account Creation Policy:</strong>
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-2">
            User accounts must be created by system administrators. If you need an account, please contact your administrator.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">How to get an account:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Contact your system administrator</li>
            <li>Provide your email address and required information</li>
            <li>Wait for the administrator to create your account</li>
            <li>You will receive login credentials via email</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

