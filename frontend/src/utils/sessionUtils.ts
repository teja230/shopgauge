/**
 * Client-side session management utilities
 * Provides heartbeat functionality to detect browser closure and maintain active sessions
 */

interface SessionHeartbeatResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
  shop?: string;
  activeSessionCount?: number;
  timestamp?: number;
  error?: string;
  sessionInvalidated?: boolean; // New field to indicate session invalidation
  needsRefresh?: boolean; // New field to indicate session needs refresh
}

interface SessionConfig {
  heartbeatInterval: number; // in milliseconds
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  autoRefreshOnInvalidation?: boolean; // Optional config option
  refreshRetryAttempts?: number; // Optional config option
}

class SessionManager {
  private heartbeatInterval: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryDelay: number;
  private lastHeartbeatTime: number = 0;
  private sessionInvalidatedCallback: (() => void) | null = null;
  private autoRefreshOnInvalidation: boolean;
  private refreshRetryAttempts: number;

  constructor(config: SessionConfig = {
    heartbeatInterval: 60000, // 1 minute
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    autoRefreshOnInvalidation: true, // Default to true
    refreshRetryAttempts: 3 // Default to 3
  }) {
    this.heartbeatInterval = config.heartbeatInterval;
    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
    this.autoRefreshOnInvalidation = config.autoRefreshOnInvalidation || true;
    this.refreshRetryAttempts = config.refreshRetryAttempts || 3;

    if (config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Start heartbeat when page loads
    this.startHeartbeat();

    // Add event listeners for page lifecycle
    window.addEventListener('beforeunload', this.handlePageUnload.bind(this));
    window.addEventListener('unload', this.handlePageUnload.bind(this));
    window.addEventListener('pagehide', this.handlePageUnload.bind(this));
    
    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Handle focus/blur events
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));

    console.log('🔄 Session manager initialized with heartbeat interval:', this.heartbeatInterval);
  }

  private handlePageUnload(): void {
    console.log('📤 Page unloading - stopping session heartbeat');
    this.stopHeartbeat();
    
    // Send immediate session termination signal
    this.sendTerminationSignal();
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('👁️ Page hidden - reducing heartbeat frequency');
      this.reduceHeartbeatFrequency();
    } else {
      console.log('👁️ Page visible - restoring normal heartbeat');
      this.restoreHeartbeatFrequency();
      this.sendHeartbeat(); // Immediate heartbeat when tab becomes visible
    }
  }

  private handleWindowFocus(): void {
    console.log('🎯 Window focused - ensuring heartbeat is active');
    if (!this.isActive) {
      this.startHeartbeat();
    }
  }

  private handleWindowBlur(): void {
    console.log('🌫️ Window blurred - maintaining heartbeat');
    // Keep heartbeat active but could reduce frequency if needed
  }

  private sendTerminationSignal(): void {
    // Use sendBeacon for reliable delivery during page unload
    if (navigator.sendBeacon) {
      const terminationData = new FormData();
      terminationData.append('action', 'session_termination');
      terminationData.append('timestamp', Date.now().toString());
      
      navigator.sendBeacon('/api/sessions/terminate-current', terminationData);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    // Only send heartbeat if authenticated
    let isAuthenticated = false;
    try {
      // Try to read from localStorage or a global variable (adjust as needed for your app)
      isAuthenticated = JSON.parse(localStorage.getItem('isAuthenticated') || 'false');
    } catch (e) { /* ignore - fallback to unauthenticated */ }
    if (!isAuthenticated) {
      // Suppress heartbeat if not authenticated
      console.log('🔕 Skipping heartbeat: user not authenticated');
      return;
    }
    try {
      const response = await fetch('/api/sessions/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
      });
      if (response.ok) {
        const data: SessionHeartbeatResponse = await response.json();
        if (data.success) {
          console.log('💓 Session heartbeat successful:', {
            sessionId: data.sessionId,
            shop: data.shop,
            activeSessionCount: data.activeSessionCount
          });
          this.lastHeartbeatTime = Date.now();
          this.retryCount = 0; // Reset retry count on success
          
          // Handle session invalidation
          if (data.sessionInvalidated) {
            console.warn('🚨 Session invalidated by server');
            this.handleSessionInvalidation();
            return;
          }
          
          // Handle session refresh needed
          if (data.needsRefresh) {
            console.warn('🔄 Session needs refresh');
            this.handleSessionRefresh();
            return;
          }
          
          // Store session info in localStorage for debugging
          if (data.sessionId && data.shop) {
            localStorage.setItem('session_info', JSON.stringify({
              sessionId: data.sessionId,
              shop: data.shop,
              lastHeartbeat: this.lastHeartbeatTime,
              activeSessionCount: data.activeSessionCount
            }));
          }
        } else {
          console.warn('⚠️ Session heartbeat failed:', data.error);
          this.handleHeartbeatFailure(data.error || 'Unknown error');
        }
      } else {
        console.error('❌ Session heartbeat HTTP error:', response.status);
        this.handleHeartbeatFailure(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Session heartbeat network error:', error);
      this.handleHeartbeatFailure('Network error');
    }
  }

  private handleSessionInvalidation(): void {
    console.warn('🚨 Session invalidated - cleaning up and notifying');
    
    // Clear session info
    this.clearSessionInfo();
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Notify callback
    if (this.sessionInvalidatedCallback) {
      this.sessionInvalidatedCallback();
    }
    
    // Trigger page refresh if auto-refresh is enabled
    if (this.autoRefreshOnInvalidation) {
      console.log('🔄 Auto-refreshing page due to session invalidation');
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1 second delay
    }
  }

  private async handleSessionRefresh(): Promise<void> {
    console.log('🔄 Attempting session refresh');
    
    try {
      const response = await fetch('/api/sessions/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Session refreshed successfully');
          // Continue with normal heartbeat
          return;
        } else {
          console.warn('⚠️ Session refresh failed:', data.error);
          this.handleSessionInvalidation();
        }
      } else {
        console.error('❌ Session refresh HTTP error:', response.status);
        this.handleSessionInvalidation();
      }
    } catch (error) {
      console.error('❌ Session refresh network error:', error);
      this.handleSessionInvalidation();
    }
  }

  private handleHeartbeatFailure(error: string): void {
    this.retryCount++;
    
    if (this.retryCount >= this.maxRetries) {
      console.error('💀 Session heartbeat failed after max retries - session may be invalid');
      this.stopHeartbeat();
      
      // Notify callback if session is invalidated
      if (this.sessionInvalidatedCallback) {
        this.sessionInvalidatedCallback();
      }
    } else {
      console.warn(`🔄 Session heartbeat retry ${this.retryCount}/${this.maxRetries} after error:`, error);
      
      // Retry after delay
      setTimeout(() => {
        this.sendHeartbeat();
      }, this.retryDelay);
    }
  }

  private reduceHeartbeatFrequency(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      // Reduce frequency to 5 minutes when page is hidden
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, 300000); // 5 minutes
    }
  }

  private restoreHeartbeatFrequency(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, this.heartbeatInterval);
    }
  }

  public startHeartbeat(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.retryCount = 0;
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Set up recurring heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    console.log('🟢 Session heartbeat started');
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.isActive = false;
    console.log('🔴 Session heartbeat stopped');
  }

  public isHeartbeatActive(): boolean {
    return this.isActive;
  }

  public getLastHeartbeatTime(): number {
    return this.lastHeartbeatTime;
  }

  public setSessionInvalidatedCallback(callback: () => void): void {
    this.sessionInvalidatedCallback = callback;
  }

  public getSessionInfo(): any {
    try {
      const sessionInfo = localStorage.getItem('session_info');
      return sessionInfo ? JSON.parse(sessionInfo) : null;
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  public clearSessionInfo(): void {
    localStorage.removeItem('session_info');
  }

  public async checkStaleEsessions(): Promise<any> {
    try {
      const response = await fetch('/api/sessions/stale-check', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Stale session check:', data);
        return data;
      } else {
        console.error('❌ Stale session check failed:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ Stale session check error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export class for custom configurations
export { SessionManager };
export type { SessionHeartbeatResponse, SessionConfig };

// Utility functions
export const getSessionStatus = () => {
  return {
    isActive: sessionManager.isHeartbeatActive(),
    lastHeartbeat: sessionManager.getLastHeartbeatTime(),
    sessionInfo: sessionManager.getSessionInfo()
  };
};

export const initializeSessionManagement = (config?: Partial<SessionConfig>) => {
  if (config) {
    // Create new instance with custom config
    return new SessionManager({
      heartbeatInterval: 60000,
      enabled: true,
      maxRetries: 3,
      retryDelay: 5000,
      ...config
    });
  }
  return sessionManager;
}; 