/**
 * Polling Fallback for SSE
 * 
 * Provides polling-based updates when SSE is not supported
 */

export interface PollingOptions {
  url: string
  interval?: number
  onUpdate?: (data: any) => void
  onError?: (error: Error) => void
}

export class PollingManager {
  private timer: NodeJS.Timeout | null = null
  private lastData: any = null
  private isActive = false
  
  private readonly url: string
  private readonly interval: number
  private readonly onUpdate?: (data: any) => void
  private readonly onError?: (error: Error) => void

  constructor(options: PollingOptions) {
    this.url = options.url
    this.interval = options.interval || 10000 // Default 10 seconds
    this.onUpdate = options.onUpdate
    this.onError = options.onError
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.isActive) {
      return
    }

    this.isActive = true
    this.poll()
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isActive = false
    
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Check if polling is active
   */
  isPolling(): boolean {
    return this.isActive
  }

  /**
   * Perform a single poll
   */
  private async poll(): Promise<void> {
    if (!this.isActive) {
      return
    }

    try {
      const response = await fetch(this.url)
      
      if (!response.ok) {
        throw new Error(`Polling failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Check if data has changed
      if (JSON.stringify(data) !== JSON.stringify(this.lastData)) {
        this.lastData = data
        this.onUpdate?.(data)
      }
    } catch (error) {
      console.error('Polling error:', error)
      this.onError?.(error as Error)
    }

    // Schedule next poll
    if (this.isActive) {
      this.timer = setTimeout(() => this.poll(), this.interval)
    }
  }
}

