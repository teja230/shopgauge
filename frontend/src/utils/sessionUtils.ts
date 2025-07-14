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
  sessionExpiring?: boolean; // New field to indicate session is expiring soon
  expiresInMinutes?: number; // Time until session expires
  needsManualRefresh?: boolean; // New field to indicate manual refresh is needed
}

interface SessionConfig {
  heartbeatInterval: number; // in milliseconds
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  showExpirationWarnings?: boolean; // Show warnings when session is expiring
  expirationWarningMinutes?: number; // Minutes before expiration to show warning
  manualRefreshEnabled?: boolean; // Enable manual refresh option
}

class SessionManager {
  private heartbeatInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private showExpirationWarnings: boolean;
  private expirationWarningMinutes: number;
  private manualRefreshEnabled: boolean;
  private intervalId: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private isInitialized = false;

  constructor(config: SessionConfig = {
    heartbeatInterval: 60000, // 1 minute
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    showExpirationWarnings: true, // Default to true
    expirationWarningMinutes: 10, // Default to 10 minutes
    manualRefreshEnabled: true // Default to true
  }) {
    this.heartbeatInterval = config.heartbeatInterval;
    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
    this.showExpirationWarnings = config.showExpirationWarnings ?? true;
    this.expirationWarningMinutes = config.expirationWarningMinutes ?? 10;
    this.manualRefreshEnabled = config.manualRefreshEnabled ?? true;

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
    if (!this.isInitialized) {
      this.initialize(); // Re-initialize if not initialized
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
          console.log('💓 Session heartbeat successful', {
            sessionId: data.sessionId,
            shop: data.shop,
            activeSessionCount: data.activeSessionCount
          });
          this.retryCount = 0; // Reset retry count on success
          
          // Handle session expiration warnings
          if (data.sessionExpiring && this.showExpirationWarnings) {
            this.handleSessionExpirationWarning(data.expiresInMinutes || 0);
          }
          
          // Handle manual refresh needed
          if (data.needsManualRefresh && this.manualRefreshEnabled) {
            this.handleManualRefreshNeeded();
          }
          
        } else {
          console.warn('⚠️ Session heartbeat failed:', data.error);
          this.handleSessionError(data.error || 'Session heartbeat failed');
        }
      } else {
        console.error('❌ Session heartbeat HTTP error:', response.status);
        this.handleSessionError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Session heartbeat network error:', error);
      this.handleSessionError('Network error during heartbeat');
    }
  }

  private handleSessionExpirationWarning(expiresInMinutes: number): void {
    console.warn(`⏰ Session expires in ${expiresInMinutes} minutes`);
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('sessionExpiring', {
      detail: {
        expiresInMinutes,
        message: `Your session will expire in ${expiresInMinutes} minutes. Please save your work and refresh the page.`
      }
    });
    window.dispatchEvent(event);
  }

  private handleManualRefreshNeeded(): void {
    console.warn('🔄 Manual session refresh required');
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('sessionRefreshNeeded', {
      detail: {
        message: 'Your session needs to be refreshed. Please click "Refresh Session" to continue.',
        action: 'refresh'
      }
    });
    window.dispatchEvent(event);
  }

  private handleSessionError(error: string): void {
    console.error('❌ Session error:', error);
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('sessionError', {
      detail: {
        error,
        message: 'Session error occurred. Please refresh the page or log in again.'
      }
    });
    window.dispatchEvent(event);
  }

  private handleSessionInvalidation(): void {
    console.warn('🚨 Session invalidated by server');
    
    // Dispatch custom event for UI to handle
    const event = new CustomEvent('sessionInvalidated', {
      detail: {
        message: 'Your session has been invalidated. Please log in again.',
        action: 'logout'
      }
    });
    window.dispatchEvent(event);
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
      // if (this.sessionInvalidatedCallback) { // This line is removed
      //   this.sessionInvalidatedCallback();
      // }
    } else {
      console.warn(`🔄 Session heartbeat retry ${this.retryCount}/${this.maxRetries} after error:`, error);
      
      // Retry after delay
      setTimeout(() => {
        this.sendHeartbeat();
      }, this.retryDelay);
    }
  }

  private reduceHeartbeatFrequency(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      // Reduce frequency to 5 minutes when page is hidden
      this.intervalId = setInterval(() => {
        this.sendHeartbeat();
      }, 300000); // 5 minutes
    }
  }

  private restoreHeartbeatFrequency(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.sendHeartbeat();
      }, this.heartbeatInterval);
    }
  }

  public startHeartbeat(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    this.retryCount = 0;
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Set up recurring heartbeat
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    console.log('🟢 Session heartbeat started');
  }

  public stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isInitialized = false;
    console.log('🔴 Session heartbeat stopped');
  }

  public isHeartbeatActive(): boolean {
    return this.isInitialized;
  }

  // public getLastHeartbeatTime(): number { // This line is removed
  //   return this.lastHeartbeatTime;
  // }

  // public setSessionInvalidatedCallback(callback: () => void): void { // This line is removed
  //   this.sessionInvalidatedCallback = callback;
  // }

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
    // lastHeartbeat: sessionManager.getLastHeartbeatTime(), // This line is removed
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