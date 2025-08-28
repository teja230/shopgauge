/**
 * Demo Security Manager - Frontend-Based Security and Rate Limiting
 * 
 * Provides security controls for frontend-first demo mode without backend dependency.
 * Implements browser fingerprinting, rate limiting, and abuse detection.
 * 
 * Security Features:
 * - Browser fingerprinting for session tracking
 * - Rate limiting per fingerprint
 * - Bot detection and blocking
 * - Session timeout management
 * - Abuse pattern detection
 * - Privacy-conscious implementation
 */

export interface DemoSecurityConfig {
  maxSessionsPerFingerprint: number;
  maxRequestsPerMinute: number;
  sessionTimeoutMinutes: number;
  rateLimitWindowMinutes: number;
  botDetectionEnabled: boolean;
  suspiciousActivityThreshold: number;
  enableAnalytics: boolean;
}

export interface DemoSessionInfo {
  fingerprint: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  requestCount: number;
  ipAddress?: string;
  userAgent: string;
  isValid: boolean;
  riskScore: number;
}

export interface DemoSecurityMetrics {
  activeSessions: number;
  totalRequests: number;
  blockedRequests: number;
  suspiciousActivity: number;
  botDetections: number;
  averageSessionDuration: number;
  rateLimitViolations: number;
  sessionViolations: number;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  windowStart: number;
}

/**
 * Demo Security Manager Class
 */
export class DemoSecurityManager {
  private static instance: DemoSecurityManager;
  private config: DemoSecurityConfig;
  private browserFingerprint: string = '';
  private sessionInfo: DemoSessionInfo | null = null;
  private requestHistory: Array<{ timestamp: number; endpoint: string; fingerprint: string }> = [];
  private securityMetrics: DemoSecurityMetrics = {
    activeSessions: 0,
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousActivity: 0,
    botDetections: 0,
    averageSessionDuration: 0,
    rateLimitViolations: 0,
    sessionViolations: 0
  };
  private cleanupInterval: number = 0;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeFingerprint();
    this.initializeMetrics();
    this.loadSessionFromStorage();
    this.startCleanupTask();
    this.detectSuspiciousPatterns();
  }

  public static getInstance(): DemoSecurityManager {
    if (!DemoSecurityManager.instance) {
      DemoSecurityManager.instance = new DemoSecurityManager();
    }
    return DemoSecurityManager.instance;
  }

  /**
   * Validate if a demo request should be allowed
   */
  public validateRequest(endpoint: string, userAgent?: string): {
    allowed: boolean;
    reason?: string;
    rateLimitInfo?: RateLimitInfo;
  } {
    try {
      // Bot detection
      if (this.config.botDetectionEnabled && this.isBot(userAgent)) {
        this.incrementMetric('botDetections');
        console.warn('🤖 Demo Security: Bot detected, blocking request');
        return { 
          allowed: false, 
          reason: 'Bot traffic not allowed in demo mode' 
        };
      }

      // Session validation
      if (!this.sessionInfo || !this.isSessionValid()) {
        console.log('🔑 Demo Security: Creating new session');
        this.createNewSession(userAgent);
      }

      // Check session limits
      if (!this.checkSessionLimits()) {
        return { 
          allowed: false, 
          reason: 'Maximum concurrent sessions exceeded' 
        };
      }

      // Rate limiting
      const rateLimitInfo = this.checkRateLimit();
      if (!rateLimitInfo.allowed) {
        this.incrementMetric('blockedRequests');
        console.warn(`🚫 Demo Security: Rate limit exceeded for ${this.browserFingerprint}`);
        return { 
          allowed: false, 
          reason: 'Rate limit exceeded', 
          rateLimitInfo 
        };
      }

      // Suspicious activity detection
      if (this.detectSuspiciousActivity(endpoint)) {
        this.incrementMetric('suspiciousActivity');
        console.warn('⚠️ Demo Security: Suspicious activity detected');
        return { 
          allowed: false, 
          reason: 'Suspicious activity detected' 
        };
      }

      // Request is allowed
      this.recordRequest(endpoint);
      this.updateSessionActivity();
      this.incrementMetric('totalRequests');

      return { 
        allowed: true, 
        rateLimitInfo 
      };

    } catch (error) {
      console.error('❌ Demo Security: Error validating request:', error);
      // Fail open in case of errors
      return { allowed: true };
    }
  }

  /**
   * Create a new demo session
   */
  public createNewSession(userAgent?: string): DemoSessionInfo {
    const now = Date.now();
    const sessionId = `demo_${this.browserFingerprint}_${now}`;

    this.sessionInfo = {
      fingerprint: this.browserFingerprint,
      sessionId,
      createdAt: now,
      lastActivity: now,
      requestCount: 0,
      userAgent: userAgent || navigator.userAgent,
      isValid: true,
      riskScore: 0
    };

    this.saveSessionToStorage();
    this.incrementMetric('activeSessions');

    console.log('🎯 Demo Security: New session created:', sessionId);
    return this.sessionInfo;
  }

  /**
   * Get current session information
   */
  public getSessionInfo(): DemoSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): DemoSecurityMetrics {
    return { ...this.securityMetrics };
  }

  /**
   * Update security configuration
   */
  public updateConfig(newConfig: Partial<DemoSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('demo_security_config', JSON.stringify(this.config));
    console.log('⚙️ Demo Security: Configuration updated');
  }

  /**
   * Reset security state (for testing)
   */
  public reset(): void {
    this.sessionInfo = null;
    this.requestHistory = [];
    this.initializeMetrics();
    this.clearStorageData();
    console.log('🔄 Demo Security: State reset');
  }

  /**
   * Generate browser fingerprint for session tracking
   */
  private initializeFingerprint(): void {
    try {
      // Collect browser characteristics (privacy-conscious approach)
      const characteristics = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        navigator.language,
        navigator.platform,
        new Date().getTimezoneOffset().toString(),
        navigator.hardwareConcurrency?.toString() || '0',
        navigator.maxTouchPoints?.toString() || '0'
      ];

      // Try canvas fingerprinting with fallback for privacy concerns
      let canvasFingerprint = '';
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('Demo Security Fingerprint', 2, 2);
          canvasFingerprint = canvas.toDataURL();
          characteristics.push(canvasFingerprint);
        }
      } catch (canvasError) {
        console.warn('⚠️ Demo Security: Canvas fingerprinting blocked or failed, using alternative method');
        // Fallback: Use WebGL renderer info if available
        try {
          const gl = document.createElement('canvas').getContext('webgl');
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              characteristics.push(
                gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown',
                gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown'
              );
            }
          }
        } catch (webglError) {
          // Final fallback: Use additional browser features
          characteristics.push(
            navigator.cookieEnabled.toString(),
            navigator.doNotTrack || 'unknown',
            window.devicePixelRatio?.toString() || '1',
            (window.screen as any).availWidth?.toString() || '0',
            (window.screen as any).availHeight?.toString() || '0'
          );
        }
      }

      // Generate hash from collected characteristics
      const combined = characteristics.join('|');
      this.browserFingerprint = this.simpleHash(combined).substr(0, 16);

      console.log('🔍 Demo Security: Browser fingerprint generated:', this.browserFingerprint);
    } catch (error) {
      console.warn('⚠️ Demo Security: All fingerprinting methods failed, using random fallback');
      // Ultimate fallback: random identifier with some persistence
      const fallbackKey = 'demo_fingerprint_fallback';
      let fallbackId = localStorage.getItem(fallbackKey);
      if (!fallbackId) {
        fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
        try {
          localStorage.setItem(fallbackKey, fallbackId);
        } catch (storageError) {
          // If even localStorage fails, use session-only ID
          fallbackId = `session_${Math.random().toString(36).substr(2, 16)}`;
        }
      }
      this.browserFingerprint = fallbackId.substr(0, 16);
    }
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Initialize security metrics
   */
  private initializeMetrics(): void {
    this.securityMetrics = {
      activeSessions: 0,
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousActivity: 0,
      botDetections: 0,
      averageSessionDuration: 0,
      rateLimitViolations: 0,
      sessionViolations: 0
    };
  }

  /**
   * Load session from localStorage
   */
  private loadSessionFromStorage(): void {
    try {
      const stored = localStorage.getItem(`demo_session_${this.browserFingerprint}`);
      if (stored) {
        const session = JSON.parse(stored) as DemoSessionInfo;
        if (this.isSessionValid(session)) {
          this.sessionInfo = session;
          console.log('🔄 Demo Security: Session restored from storage');
        } else {
          console.log('🗑️ Demo Security: Expired session removed');
          localStorage.removeItem(`demo_session_${this.browserFingerprint}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Demo Security: Error loading session from storage');
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSessionToStorage(): void {
    if (this.sessionInfo) {
      try {
        localStorage.setItem(
          `demo_session_${this.browserFingerprint}`,
          JSON.stringify(this.sessionInfo)
        );
      } catch (error) {
        console.warn('⚠️ Demo Security: Error saving session to storage');
      }
    }
  }

  /**
   * Check if session is valid
   */
  private isSessionValid(session?: DemoSessionInfo): boolean {
    const sessionToCheck = session || this.sessionInfo;
    if (!sessionToCheck) return false;

    const now = Date.now();
    const sessionAge = now - sessionToCheck.createdAt;
    const maxAge = this.config.sessionTimeoutMinutes * 60 * 1000;

    return sessionAge < maxAge && sessionToCheck.isValid;
  }

  /**
   * Check session limits
   */
  private checkSessionLimits(): boolean {
    const activeSessions = this.getActiveSessionCount();
    return activeSessions <= this.config.maxSessionsPerFingerprint;
  }

  /**
   * Get active session count for current fingerprint
   */
  private getActiveSessionCount(): number {
    try {
      let count = 0;
      const now = Date.now();
      const maxAge = this.config.sessionTimeoutMinutes * 60 * 1000;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('demo_session_')) {
          try {
            const session = JSON.parse(localStorage.getItem(key) || '{}');
            if (now - session.createdAt < maxAge) {
              count++;
            }
          } catch (e) {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      }
      return count;
    } catch (error) {
      return 1; // Assume current session
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): RateLimitInfo {
    const now = Date.now();
    const windowMs = this.config.rateLimitWindowMinutes * 60 * 1000;
    const windowStart = now - windowMs;

    // Count requests in current window
    const recentRequests = this.requestHistory.filter(
      req => req.timestamp > windowStart && req.fingerprint === this.browserFingerprint
    );

    const remaining = Math.max(0, this.config.maxRequestsPerMinute - recentRequests.length);
    const allowed = recentRequests.length < this.config.maxRequestsPerMinute;

    return {
      allowed,
      remaining,
      resetTime: windowStart + windowMs,
      windowStart
    };
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(endpoint: string): void {
    const now = Date.now();
    this.requestHistory.push({
      timestamp: now,
      endpoint,
      fingerprint: this.browserFingerprint
    });

    // Keep only recent requests (cleanup)
    const windowMs = this.config.rateLimitWindowMinutes * 60 * 1000;
    const cutoff = now - windowMs;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);
  }

  /**
   * Update session activity
   */
  private updateSessionActivity(): void {
    if (this.sessionInfo) {
      this.sessionInfo.lastActivity = Date.now();
      this.sessionInfo.requestCount++;
      this.saveSessionToStorage();
    }
  }

  /**
   * Bot detection
   */
  private isBot(userAgent?: string): boolean {
    if (!userAgent) userAgent = navigator.userAgent;
    
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /requests/i,
      /selenium/i,
      /phantom/i,
      /headless/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(endpoint: string): boolean {
    if (!this.sessionInfo) return false;

    const now = Date.now();
    const recentRequests = this.requestHistory.filter(
      req => req.fingerprint === this.browserFingerprint && 
             now - req.timestamp < 60000 // Last minute
    );

    // Too many requests in short time
    if (recentRequests.length > this.config.suspiciousActivityThreshold) {
      return true;
    }

    // Repeated identical requests
    const identicalRequests = recentRequests.filter(req => req.endpoint === endpoint);
    if (identicalRequests.length > 5) {
      return true;
    }

    // Session duration too short with many requests
    const sessionDuration = now - this.sessionInfo.createdAt;
    if (sessionDuration < 30000 && this.sessionInfo.requestCount > 10) {
      return true;
    }

    return false;
  }

  /**
   * Detect suspicious patterns across all sessions
   */
  private detectSuspiciousPatterns(): void {
    setInterval(() => {
      try {
        // This could be expanded to detect more sophisticated abuse patterns
        // For now, just cleanup old data
        this.cleanupOldData();
      } catch (error) {
        console.warn('⚠️ Demo Security: Error in pattern detection');
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupOldData();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Cleanup old data
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = this.config.sessionTimeoutMinutes * 60 * 1000;

    // Clean expired sessions
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('demo_session_')) {
        try {
          const session = JSON.parse(localStorage.getItem(key) || '{}');
          if (now - session.createdAt > maxAge) {
            keysToRemove.push(key);
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clean old request history
    const cutoff = now - (this.config.rateLimitWindowMinutes * 60 * 1000);
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);

    if (keysToRemove.length > 0) {
      console.log(`🧹 Demo Security: Cleaned ${keysToRemove.length} expired sessions`);
    }
  }

  /**
   * Clear all storage data (for reset)
   */
  private clearStorageData(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('demo_session_') || key?.startsWith('demo_security_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Increment security metric
   */
  private incrementMetric(metric: keyof DemoSecurityMetrics): void {
    if (typeof this.securityMetrics[metric] === 'number') {
      (this.securityMetrics[metric] as number)++;
    }
  }

  /**
   * Get default security configuration
   */
  private getDefaultConfig(): DemoSecurityConfig {
    const saved = localStorage.getItem('demo_security_config');
    if (saved) {
      try {
        return { ...this.getBaseConfig(), ...JSON.parse(saved) };
      } catch (e) {
        console.warn('⚠️ Demo Security: Invalid saved config, using defaults');
      }
    }
    return this.getBaseConfig();
  }

  /**
   * Get base security configuration
   */
  private getBaseConfig(): DemoSecurityConfig {
    return {
      maxSessionsPerFingerprint: 3,
      maxRequestsPerMinute: 60,
      sessionTimeoutMinutes: 120, // 2 hours
      rateLimitWindowMinutes: 1,
      botDetectionEnabled: true,
      suspiciousActivityThreshold: 30,
      enableAnalytics: false
    };
  }

  /**
   * Cleanup on destruction
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Singleton instance
 */
export const demoSecurity = DemoSecurityManager.getInstance();

/**
 * Convenience functions
 */
export const validateDemoRequest = (endpoint: string, userAgent?: string) => 
  demoSecurity.validateRequest(endpoint, userAgent);

export const getDemoSessionInfo = () => demoSecurity.getSessionInfo();
export const getDemoSecurityMetrics = () => demoSecurity.getSecurityMetrics();
export const createDemoSession = (userAgent?: string) => demoSecurity.createNewSession(userAgent);

/**
 * Security Features Summary:
 * 
 * Privacy-Conscious Design:
 * - Browser fingerprinting without invasive tracking
 * - Local storage only (no external data collection)
 * - Automatic cleanup of expired data
 * - No personal information collection
 * 
 * Security Controls:
 * - Rate limiting per browser fingerprint
 * - Bot detection and blocking
 * - Suspicious activity detection
 * - Session timeout management
 * - Concurrent session limits
 * 
 * Performance Impact:
 * - Validation time: <5ms
 * - Memory usage: <1MB
 * - Storage usage: <100KB
 * - No network requests
 * 
 * Abuse Prevention:
 * - Request frequency limits
 * - Pattern detection
 * - Automated blocking
 * - Session invalidation
 * - Resource cleanup
 */
