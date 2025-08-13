/**
 * Enterprise-Grade SSE Handler
 * 
 * Production-ready Server-Sent Events handler with:
 * - Server-controlled reconnect delays
 * - Proper cleanup on logout/tab close
 * - Fallback to polling when rate-limited
 * - Comprehensive error handling and monitoring
 * - Memory leak prevention
 * - Performance optimization
 */

import { debugLog } from '../components/ui/DebugPanel';

// Types and Interfaces
export interface SseEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
  timestamp: number;
}

export interface SseConnectionConfig {
  url: string;
  shopDomain?: string;
  withCredentials?: boolean;
  headers?: Record<string, string>;
  timeout?: number;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  enableHeartbeat?: boolean;
  enableDebug?: boolean;
  pollingFallbackEnabled?: boolean;
  pollingInterval?: number;
  pollingTimeout?: number;
}

export interface SseConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  isPolling: boolean;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
  lastMessageAt?: Date;
  connectionDuration: number;
  messageCount: number;
  errorCount: number;
  rateLimitedUntil?: Date;
  serverReconnectDelay?: number;
}

export interface SseEventHandler {
  onConnect?: (event: Event) => void;
  onMessage?: (event: SseEvent) => void;
  onError?: (error: Event) => void;
  onReconnect?: (attempt: number) => void;
  onDisconnect?: (reason: string) => void;
  onHeartbeat?: () => void;
  onRateLimited?: (until: Date) => void;
  onPollingStart?: () => void;
  onPollingStop?: () => void;
  onSseDisabled?: (data: any) => void;
}

export interface SseMetrics {
  totalConnections: number;
  totalMessages: number;
  totalErrors: number;
  totalRateLimits: number;
  totalPollingSessions: number;
  averageReconnectTime: number;
  uptimePercentage: number;
  lastResetAt: Date;
}

class EnterpriseSseHandler {
  private eventSource: EventSource | null = null;
  private config: Required<SseConnectionConfig>;
  private state: SseConnectionState;
  private handlers: SseEventHandler;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private connectionStartTime: number = 0;
  private metrics: SseMetrics;
  private isDestroyed: boolean = false;
  private messageQueue: SseEvent[] = [];
  private maxQueueSize: number = 100;
  private abortController: AbortController | null = null;

  constructor(config: SseConnectionConfig, handlers: SseEventHandler = {}) {
    this.config = {
      url: config.url,
      shopDomain: config.shopDomain || '',
      withCredentials: config.withCredentials ?? true,
      headers: config.headers || {},
      timeout: config.timeout || 30000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      initialReconnectDelay: config.initialReconnectDelay || 1000,
      maxReconnectDelay: config.maxReconnectDelay || 30000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      enableHeartbeat: config.enableHeartbeat ?? true,
      enableDebug: config.enableDebug ?? false,
      pollingFallbackEnabled: config.pollingFallbackEnabled ?? true,
      pollingInterval: config.pollingInterval || 5000,
      pollingTimeout: config.pollingTimeout || 10000
    };

    this.handlers = handlers;
    this.state = this.createInitialState();
    this.metrics = this.createInitialMetrics();

    this.log('Enterprise SSE Handler initialized', { config: this.config });
    
    // Set up global event listeners for cleanup
    this.setupGlobalEventListeners();
  }

  private createInitialState(): SseConnectionState {
    return {
      isConnected: false,
      isReconnecting: false,
      isPolling: false,
      reconnectAttempts: 0,
      connectionDuration: 0,
      messageCount: 0,
      errorCount: 0
    };
  }

  private createInitialMetrics(): SseMetrics {
    return {
      totalConnections: 0,
      totalMessages: 0,
      totalErrors: 0,
      totalRateLimits: 0,
      totalPollingSessions: 0,
      averageReconnectTime: 0,
      uptimePercentage: 0,
      lastResetAt: new Date()
    };
  }

  /**
   * Set up global event listeners for proper cleanup
   */
  private setupGlobalEventListeners(): void {
    // Handle page unload/tab close
    const handlePageUnload = () => {
      this.log('Page unloading, cleaning up SSE connection');
      this.cleanup();
    };

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.log('Page hidden, pausing heartbeat');
        this.pauseHeartbeat();
      } else {
        this.log('Page visible, resuming heartbeat');
        this.resumeHeartbeat();
      }
    };

    // Handle window focus/blur
    const handleWindowFocus = () => {
      this.log('Window focused, checking connection health');
      this.checkConnectionHealth();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Store cleanup function
    this.globalCleanup = () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }

  private globalCleanup: (() => void) | null = null;

  /**
   * Connect to the SSE endpoint
   */
  public connect(): void {
    if (this.isDestroyed) {
      this.log('Cannot connect: handler is destroyed');
      return;
    }

    if (this.state.isConnected || this.state.isReconnecting) {
      this.log('Already connected or reconnecting');
      return;
    }

    // Check if rate limited
    if (this.state.rateLimitedUntil && this.state.rateLimitedUntil > new Date()) {
      this.log('Rate limited, starting polling fallback');
      this.startPollingFallback();
      return;
    }

    this.log('Connecting to SSE endpoint', { url: this.config.url });
    this.state.isReconnecting = true;

    try {
      // Create EventSource with proper configuration
      this.eventSource = new EventSource(this.config.url, {
        withCredentials: this.config.withCredentials
      } as any);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!this.state.isConnected) {
          this.log('Connection timeout', { timeout: this.config.timeout });
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, this.config.timeout);

      // Override onopen to clear timeout
      const originalOnOpen = this.eventSource.onopen;
      this.eventSource.onopen = (event) => {
        clearTimeout(connectionTimeout);
        this.handleConnectionOpen(event);
        if (originalOnOpen && this.eventSource) originalOnOpen.call(this.eventSource, event);
      };

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      this.log('Failed to create EventSource', { error });
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventSource) return;

    // Connection opened
    this.eventSource.onopen = (event) => {
      this.handleConnectionOpen(event);
    };

    // Message received
    this.eventSource.onmessage = (event) => {
      this.handleMessage(event);
    };

    // Connection error
    this.eventSource.onerror = (event) => {
      this.handleConnectionError(event);
    };

    // Custom event listeners for specific event types
    this.setupCustomEventListeners();
  }

  /**
   * Set up custom event listeners for specific event types
   */
  private setupCustomEventListeners(): void {
    if (!this.eventSource) return;

    const customEvents = [
      'session_invalidated',
      'session_expired',
      'session_extended',
      'heartbeat',
      'system_alert',
      'data_update',
      'rate_limited'
    ];

    customEvents.forEach(eventType => {
      this.eventSource!.addEventListener(eventType, (event: MessageEvent) => {
        this.handleCustomEvent(eventType, event);
      });
    });
  }

  /**
   * Handle connection opened
   */
  private handleConnectionOpen(event: Event): void {
    this.state.isConnected = true;
    this.state.isReconnecting = false;
    this.state.isPolling = false;
    this.state.reconnectAttempts = 0;
    this.state.lastConnectedAt = new Date();
    this.connectionStartTime = Date.now();
    this.metrics.totalConnections++;

    // Clear rate limit state
    this.state.rateLimitedUntil = undefined;
    this.state.serverReconnectDelay = undefined;

    this.log('SSE connection established', {
      url: this.config.url,
      timestamp: this.state.lastConnectedAt
    });

    // Stop polling if it was active
    this.stopPollingFallback();

    // Start heartbeat if enabled
    if (this.config.enableHeartbeat) {
      this.startHeartbeat();
    }

    // Call handler
    if (this.handlers.onConnect) {
      try {
        this.handlers.onConnect(event);
      } catch (error) {
        this.log('Error in onConnect handler', { error });
      }
    }

    // Process queued messages
    this.processMessageQueue();
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    this.state.lastMessageAt = new Date();
    this.state.messageCount++;
    this.metrics.totalMessages++;

    try {
      const sseEvent: SseEvent = {
        type: 'message',
        data: this.parseMessageData(event.data),
        id: event.lastEventId || undefined,
        retry: this.parseRetryHeader(event),
        timestamp: Date.now()
      };

      this.log('SSE message received', {
        type: sseEvent.type,
        id: sseEvent.id,
        retry: sseEvent.retry,
        dataLength: JSON.stringify(sseEvent.data).length
      });

      // Add to queue if connection is not ready
      if (!this.state.isConnected) {
        this.addToMessageQueue(sseEvent);
        return;
      }

      // Call handler
      if (this.handlers.onMessage) {
        try {
          this.handlers.onMessage(sseEvent);
        } catch (error) {
          this.log('Error in onMessage handler', { error });
        }
      }

    } catch (error) {
      this.log('Failed to parse SSE message', { error, data: event.data });
      this.state.errorCount++;
    }
  }

  /**
   * Parse retry header from SSE event
   */
  private parseRetryHeader(event: MessageEvent): number | undefined {
    // Note: EventSource doesn't expose headers directly
    // This would need to be handled by the server in the event data
    return undefined;
  }

  /**
   * Handle custom SSE events
   */
  private handleCustomEvent(eventType: string, event: MessageEvent): void {
    try {
      const sseEvent: SseEvent = {
        type: eventType,
        data: this.parseMessageData(event.data),
        id: event.lastEventId,
        timestamp: Date.now()
      };

      this.log('Custom SSE event received', {
        type: eventType,
        id: sseEvent.id
      });

      // Handle rate limiting
      if (eventType === 'rate_limited') {
        this.handleRateLimit(sseEvent.data);
        return;
      }

      // Handle SSE disabled
      if (eventType === 'sse_disabled') {
        this.handleSseDisabled(sseEvent.data);
        return;
      }

      // Call handler
      if (this.handlers.onMessage) {
        try {
          this.handlers.onMessage(sseEvent);
        } catch (error) {
          this.log('Error in custom event handler', { error, eventType });
        }
      }

    } catch (error) {
      this.log('Failed to handle custom event', { error, eventType, data: event.data });
    }
  }

  /**
   * Handle SSE disabled event
   */
  private handleSseDisabled(data: any): void {
    this.log('SSE is disabled by server', { data });
    
    // Disconnect current connection
    this.disconnect();
    
    // Start polling fallback if enabled
    if (this.config.pollingFallbackEnabled) {
      this.startPollingFallback();
    }
    
    // Call SSE disabled handler if provided
    if (this.handlers.onSseDisabled) {
      try {
        this.handlers.onSseDisabled(data);
      } catch (error) {
        this.log('Error in onSseDisabled handler', { error });
      }
    }
  }

  /**
   * Handle rate limiting
   */
  private handleRateLimit(data: any): void {
    const retryAfter = data.retry_after || data.retryAfter || 60; // Default 60 seconds
    const until = new Date(Date.now() + retryAfter * 1000);
    
    this.state.rateLimitedUntil = until;
    this.state.serverReconnectDelay = retryAfter * 1000;
    this.metrics.totalRateLimits++;

    this.log('Rate limited by server', { retryAfter, until });

    // Call rate limit handler
    if (this.handlers.onRateLimited) {
      try {
        this.handlers.onRateLimited(until);
      } catch (error) {
        this.log('Error in onRateLimited handler', { error });
      }
    }

    // Disconnect current connection
    this.disconnect();

    // Start polling fallback if enabled
    if (this.config.pollingFallbackEnabled) {
      this.startPollingFallback();
    } else {
      // Schedule reconnection after rate limit expires
      this.scheduleReconnect(retryAfter * 1000);
    }
  }

  /**
   * Start polling fallback
   */
  private startPollingFallback(): void {
    if (this.state.isPolling) return;

    this.log('Starting polling fallback');
    this.state.isPolling = true;
    this.metrics.totalPollingSessions++;

    // Call polling start handler
    if (this.handlers.onPollingStart) {
      try {
        this.handlers.onPollingStart();
      } catch (error) {
        this.log('Error in onPollingStart handler', { error });
      }
    }

    // Start polling
    this.pollingInterval = setInterval(() => {
      this.performPollingRequest();
    }, this.config.pollingInterval);
  }

  /**
   * Stop polling fallback
   */
  private stopPollingFallback(): void {
    if (!this.state.isPolling) return;

    this.log('Stopping polling fallback');
    this.state.isPolling = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Call polling stop handler
    if (this.handlers.onPollingStop) {
      try {
        this.handlers.onPollingStop();
      } catch (error) {
        this.log('Error in onPollingStop handler', { error });
      }
    }
  }

  /**
   * Perform polling request
   */
  private async performPollingRequest(): Promise<void> {
    if (!this.state.isPolling) return;

    try {
      this.abortController = new AbortController();
      
      const response = await fetch(this.config.url, {
        method: 'GET',
        credentials: this.config.withCredentials ? 'include' : 'omit',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...this.config.headers
        },
        signal: this.abortController.signal
      });

      if (response.ok) {
        // Check if we can switch back to SSE
        if (!this.state.rateLimitedUntil || this.state.rateLimitedUntil <= new Date()) {
          this.log('Rate limit expired, switching back to SSE');
          this.stopPollingFallback();
          this.connect();
        }
      } else if (response.status === 429) {
        // Still rate limited
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000;
          this.state.rateLimitedUntil = new Date(Date.now() + delay);
          this.log('Still rate limited', { retryAfter, delay });
        }
      }
         } catch (error) {
       if (error instanceof Error && error.name === 'AbortError') {
         // Request was aborted, ignore
         return;
       }
       this.log('Polling request failed', { error });
     } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Event | Error): void {
    this.state.errorCount++;
    this.metrics.totalErrors++;

    const errorMessage = error instanceof Error ? error.message : 'Connection error';
    this.log('SSE connection error', { error: errorMessage });

    // Call error handler
    if (this.handlers.onError) {
      try {
        this.handlers.onError(error as Event);
      } catch (handlerError) {
        this.log('Error in onError handler', { error: handlerError });
      }
    }

    // Attempt reconnection if not destroyed
    if (!this.isDestroyed && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.handleDisconnect('Max reconnection attempts reached');
    }
  }

  /**
   * Schedule reconnection with server-controlled delay
   */
  private scheduleReconnect(customDelay?: number): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.state.isConnected = false;
    this.state.isReconnecting = true;
    this.state.reconnectAttempts++;

    // Use server-provided delay if available, otherwise use exponential backoff
    let delay = customDelay;
    if (!delay) {
      if (this.state.serverReconnectDelay) {
        delay = this.state.serverReconnectDelay;
        this.state.serverReconnectDelay = undefined; // Use only once
      } else {
        delay = Math.min(
          this.config.initialReconnectDelay * Math.pow(2, this.state.reconnectAttempts - 1),
          this.config.maxReconnectDelay
        );
      }
    }

    this.log('Scheduling reconnection', {
      attempt: this.state.reconnectAttempts,
      delay,
      maxAttempts: this.config.maxReconnectAttempts
    });

    this.reconnectTimeout = setTimeout(() => {
      this.log('Attempting reconnection', { attempt: this.state.reconnectAttempts });
      
      if (this.handlers.onReconnect) {
        try {
          this.handlers.onReconnect(this.state.reconnectAttempts);
        } catch (error) {
          this.log('Error in onReconnect handler', { error });
        }
      }

      this.connect();
    }, delay);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason: string): void {
    this.state.isConnected = false;
    this.state.isReconnecting = false;
    this.stopHeartbeat();
    this.stopPollingFallback();

    this.log('SSE connection disconnected', { reason });

    if (this.handlers.onDisconnect) {
      try {
        this.handlers.onDisconnect(reason);
      } catch (error) {
        this.log('Error in onDisconnect handler', { error });
      }
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.state.isConnected) {
        this.log('SSE heartbeat check');
        
        if (this.handlers.onHeartbeat) {
          try {
            this.handlers.onHeartbeat();
          } catch (error) {
            this.log('Error in onHeartbeat handler', { error });
          }
        }

        // Check if we haven't received a message in a while
        if (this.state.lastMessageAt) {
          const timeSinceLastMessage = Date.now() - this.state.lastMessageAt.getTime();
          if (timeSinceLastMessage > this.config.heartbeatInterval * 2) {
            this.log('No messages received recently, checking connection health');
            this.checkConnectionHealth();
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Pause heartbeat (when page is hidden)
   */
  private pauseHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Resume heartbeat (when page becomes visible)
   */
  private resumeHeartbeat(): void {
    if (this.config.enableHeartbeat && this.state.isConnected && !this.heartbeatInterval) {
      this.startHeartbeat();
    }
  }

  /**
   * Check connection health
   */
  private checkConnectionHealth(): void {
    if (!this.eventSource || !this.state.isConnected) return;

    // Check if EventSource is in a healthy state
    if (this.eventSource.readyState === EventSource.CLOSED) {
      this.log('EventSource is closed, triggering reconnection');
      this.handleConnectionError(new Error('EventSource closed'));
    }
  }

  /**
   * Parse message data safely
   */
  private parseMessageData(data: string): any {
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch (error) {
      // If JSON parsing fails, return the raw string
      return data;
    }
  }

  /**
   * Add message to queue
   */
  private addToMessageQueue(event: SseEvent): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    this.messageQueue.push(event);
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event && this.handlers.onMessage) {
        try {
          this.handlers.onMessage(event);
        } catch (error) {
          this.log('Error processing queued message', { error });
        }
      }
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  public disconnect(): void {
    this.log('Disconnecting SSE connection');
    
    this.state.isReconnecting = false;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.handleDisconnect('Manual disconnect');
  }

  /**
   * Clean up the SSE handler completely
   */
  public cleanup(): void {
    this.log('Cleaning up SSE handler');
    
    this.disconnect();
    this.stopPollingFallback();
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Destroy the SSE handler completely
   */
  public destroy(): void {
    this.log('Destroying SSE handler');
    
    this.isDestroyed = true;
    this.cleanup();
    
    // Clear all state
    this.state = this.createInitialState();
    this.messageQueue = [];
    
    // Clean up global event listeners
    if (this.globalCleanup) {
      this.globalCleanup();
      this.globalCleanup = null;
    }
  }

  /**
   * Get current connection state
   */
  public getState(): SseConnectionState {
    return {
      ...this.state,
      connectionDuration: this.state.lastConnectedAt 
        ? Date.now() - this.state.lastConnectedAt.getTime()
        : 0
    };
  }

  /**
   * Get connection metrics
   */
  public getMetrics(): SseMetrics {
    const uptime = this.state.lastConnectedAt 
      ? (Date.now() - this.state.lastConnectedAt.getTime()) / 1000
      : 0;
    
    return {
      ...this.metrics,
      uptimePercentage: uptime > 0 ? Math.min((uptime / 3600) * 100, 100) : 0
    };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.log('Metrics reset');
  }

  /**
   * Check if the handler is connected
   */
  public isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Check if the handler is reconnecting
   */
  public isReconnecting(): boolean {
    return this.state.isReconnecting;
  }

  /**
   * Check if the handler is polling
   */
  public isPolling(): boolean {
    return this.state.isPolling;
  }

  /**
   * Check if the handler is rate limited
   */
  public isRateLimited(): boolean {
    return !!(this.state.rateLimitedUntil && this.state.rateLimitedUntil > new Date());
  }

  /**
   * Get the current EventSource instance
   */
  public getEventSource(): EventSource | null {
    return this.eventSource;
  }

  /**
   * Log messages with proper formatting
   */
  private log(message: string, data?: any): void {
    if (this.config.enableDebug) {
      debugLog.info(`[EnterpriseSSE] ${message}`, data, 'SSE');
    }
  }
}

// Factory function for creating SSE handlers
export function createEnterpriseSseHandler(
  config: SseConnectionConfig,
  handlers: SseEventHandler = {}
): EnterpriseSseHandler {
  return new EnterpriseSseHandler(config, handlers);
}

// Utility function for creating SSE handlers with common configurations
export function createSessionSseHandler(
  shopDomain: string,
  handlers: SseEventHandler = {}
): EnterpriseSseHandler {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const url = `${apiBaseUrl}/api/sse/subscribe/${encodeURIComponent(shopDomain)}`;

  return createEnterpriseSseHandler({
    url,
    shopDomain,
    withCredentials: true,
    timeout: 30000,
    maxReconnectAttempts: 10,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    heartbeatInterval: 30000,
    enableHeartbeat: true,
    enableDebug: true,
    pollingFallbackEnabled: true,
    pollingInterval: 5000,
    pollingTimeout: 10000
  }, handlers);
}

// Export the main class and types
export { EnterpriseSseHandler }; 