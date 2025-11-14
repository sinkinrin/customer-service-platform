/**
 * SSE Manager
 * 
 * Manages Server-Sent Events connections with auto-reconnect
 */

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SSEEvent {
  type: string
  data?: any
}

export interface SSEManagerOptions {
  url: string
  onMessage?: (event: SSEEvent) => void
  onStateChange?: (state: SSEConnectionState) => void
  onError?: (error: Error) => void
  maxReconnectDelay?: number
  heartbeatTimeout?: number
}

export class SSEManager {
  private eventSource: EventSource | null = null
  private state: SSEConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectDelay = 1000 // Start with 1 second
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastHeartbeat: number = Date.now()
  
  private readonly url: string
  private readonly onMessage?: (event: SSEEvent) => void
  private readonly onStateChange?: (state: SSEConnectionState) => void
  private readonly onError?: (error: Error) => void
  private readonly maxReconnectDelay: number
  private readonly heartbeatTimeout: number

  constructor(options: SSEManagerOptions) {
    this.url = options.url
    this.onMessage = options.onMessage
    this.onStateChange = options.onStateChange
    this.onError = options.onError
    this.maxReconnectDelay = options.maxReconnectDelay || 30000 // Max 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 60000 // 60 seconds
  }

  /**
   * Check if browser supports SSE
   */
  static isSupported(): boolean {
    return typeof EventSource !== 'undefined'
  }

  /**
   * Connect to SSE endpoint
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }

    if (!SSEManager.isSupported()) {
      const error = new Error('SSE not supported in this browser')
      this.setState('error')
      this.onError?.(error)
      return
    }

    this.setState('connecting')
    
    try {
      this.eventSource = new EventSource(this.url)
      
      this.eventSource.onopen = () => {
        console.log('[SSE] Connection opened')
        this.setState('connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.lastHeartbeat = Date.now()
        // Don't start heartbeat monitor - EventSource handles connection health
      }

      this.eventSource.onmessage = (event) => {
        this.lastHeartbeat = Date.now()

        try {
          const data = JSON.parse(event.data)
          this.onMessage?.(data)
        } catch (error) {
          console.error('[SSE] Failed to parse message:', error)
        }
      }
      
      this.eventSource.onerror = (event) => {
        console.error('SSE error:', event)

        // Check if this is a connection close (readyState === 2 means CLOSED)
        if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
          // Connection was closed, don't reconnect if we intentionally disconnected
          if (this.state === 'disconnected') {
            return
          }
          this.handleError(new Error('SSE connection closed'))
        } else if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
          // Still trying to connect, wait for it
          return
        } else {
          // Other error, trigger reconnect
          this.handleError(new Error('SSE connection error'))
        }
      }
    } catch (error) {
      this.handleError(error as Error)
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    this.stopHeartbeatMonitor()
    this.stopReconnectTimer()
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    this.setState('disconnected')
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.state
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * Handle errors and trigger reconnect
   */
  private handleError(error: Error): void {
    this.setState('error')
    this.onError?.(error)
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    this.scheduleReconnect()
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.stopReconnectTimer()
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  /**
   * Stop reconnect timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Start heartbeat monitor
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat
      
      if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
        console.warn('Heartbeat timeout, reconnecting...')
        this.handleError(new Error('Heartbeat timeout'))
      }
    }, 10000) // Check every 10 seconds
  }

  /**
   * Stop heartbeat monitor
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * Set connection state and notify listeners
   */
  private setState(state: SSEConnectionState): void {
    if (this.state !== state) {
      this.state = state
      this.onStateChange?.(state)
    }
  }
}

