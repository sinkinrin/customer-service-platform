/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the component tree
 */

"use client"

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  translations?: {
    title: string
    description: string
    tryAgain: string
    goHome: string
  }
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const t = this.props.translations || {
        title: 'Something went wrong',
        description: 'An unexpected error occurred. Please try again.',
        tryAgain: 'Try again',
        goHome: 'Go home',
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive">{t.title}</CardTitle>
              <CardDescription>
                {t.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {this.state.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm font-mono text-destructive">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={this.handleReset} variant="default">
                {t.tryAgain}
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="outline">
                {t.goHome}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * ErrorBoundary wrapper with translations
 */
export function ErrorBoundaryWithTranslations({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const t = useTranslations('common.errorBoundary')

  return (
    <ErrorBoundary
      fallback={fallback}
      translations={{
        title: t('title'),
        description: t('description'),
        tryAgain: t('tryAgain'),
        goHome: t('goHome'),
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

