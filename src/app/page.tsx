'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, MessageSquare, Shield, Users } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'
import { getDefaultRouteForRole } from '@/lib/utils/route-helpers'

export default function HomePage() {
  const router = useRouter()
  const { user, userRole } = useAuth()

  // Auto-redirect authenticated users to their dashboard
  useEffect(() => {
    if (user && userRole) {
      const defaultRoute = getDefaultRouteForRole(userRole)
      router.replace(defaultRoute)
    }
  }, [user, userRole, router])

  // Don't render landing page if user is authenticated (will redirect)
  if (user && userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Redirecting...</h2>
          <p className="text-gray-600">Taking you to your dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Customer Service Platform
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              AI-powered customer service platform for seamless support
            </p>

            {/* Unified Login Button */}
            <Link href="/auth/login">
              <Button size="lg" className="text-lg px-8 py-6 h-auto">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In to Your Account
              </Button>
            </Link>

            <p className="text-sm text-gray-500 mt-4">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-blue-600 hover:underline">
                Sign up here
              </Link>
            </p>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <MessageSquare className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Real-time Support</h3>
              <p className="text-gray-600 text-sm">
                Connect with customers instantly through our messaging platform
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
              <p className="text-gray-600 text-sm">
                Work together with your team to resolve issues efficiently
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-sm">
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-gray-600 text-sm">
                Enterprise-grade security to protect your data and privacy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
