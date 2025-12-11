/**
 * Custom 404 Not Found Page
 * 
 * Provides a user-friendly 404 error page with navigation options
 */

import Link from 'next/link'
import { Home, ArrowLeft, Search, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="text-center max-w-md mx-auto">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-[120px] font-bold text-muted-foreground/20 leading-none select-none">
            404
          </div>
          <div className="relative -mt-16">
            <div className="w-24 h-24 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
              <Search className="w-12 h-12 text-muted-foreground/50" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          Sorry, the page you are looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default" size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="javascript:history.back()">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>

        {/* Help Link */}
        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            Need assistance?
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/customer/conversations">
              <MessageSquare className="mr-2 h-4 w-4" />
              Contact Support
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
