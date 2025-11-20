'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { getDefaultRouteForRole } from '@/lib/utils/route-helpers'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <h2 className="text-xl font-semibold text-slate-900">Loading Dashboard...</h2>
          <p className="text-sm text-slate-500">Verifying credentials</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>
            </div>
            FleetCommand
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="#" className="hover:text-blue-600 transition-colors">Solutions</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Pricing</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Resources</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Company</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 hidden sm:block">
              Log in
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <Features />

        {/* CTA Section */}
        <section className="py-20 bg-slate-900 text-white">
          <div className="container px-4 mx-auto text-center max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Ready to optimize your fleet operations?</h2>
            <p className="text-slate-300 mb-8 text-lg">
              Join over 2,000 companies using FleetCommand to reduce costs and improve safety.
            </p>
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 font-semibold">
                Start Your Free Trial
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-400">No credit card required. 14-day free trial.</p>
          </div>
        </section>
      </main>

      <footer className="py-12 bg-slate-50 border-t border-slate-200">
        <div className="container px-4 mx-auto text-center text-slate-500 text-sm">
          <p>&copy; 2025 FleetCommand Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
