interface NavigationEvent {
  timestamp: number;
  source: string;
  action: string;
  from: string;
  to: string;
  reason: string;
  authState: {
    isAuthenticated: boolean;
    authLoading: boolean;
    hasInitiallyLoaded: boolean;
  };
  additionalData?: any;
}

interface NavigationDetection {
  isInfiniteLoop: boolean;
  recentNavigations: NavigationEvent[];
  suggestion?: string;
}

class NavigationDebugger {
  private navigationHistory: NavigationEvent[] = [];
  private maxHistorySize = 50;
  private loopDetectionWindow = 5000; // 5 seconds
  private maxNavigationsInWindow = 10;
  
  logNavigation(event: Omit<NavigationEvent, 'timestamp'>) {
    const navigationEvent: NavigationEvent = {
      ...event,
      timestamp: Date.now(),
    };
    
    this.navigationHistory.push(navigationEvent);
    
    // Keep history size manageable
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory.shift();
    }
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('🧭 Navigation:', {
        source: event.source,
        action: event.action,
        from: event.from,
        to: event.to,
        reason: event.reason,
        authState: event.authState,
        timestamp: new Date(navigationEvent.timestamp).toISOString(),
      });
    }
    
    // Check for infinite loops
    const detection = this.detectInfiniteLoop();
    if (detection.isInfiniteLoop) {
      console.error('🚨 INFINITE NAVIGATION LOOP DETECTED!', detection);
      this.handleInfiniteLoop(detection);
    }
  }
  
  private detectInfiniteLoop(): NavigationDetection {
    const now = Date.now();
    const recentNavigations = this.navigationHistory.filter(
      nav => now - nav.timestamp < this.loopDetectionWindow
    );
    
    // Check if we have too many navigations in a short time
    if (recentNavigations.length >= this.maxNavigationsInWindow) {
      return {
        isInfiniteLoop: true,
        recentNavigations,
        suggestion: 'Too many navigations in a short time. Check for competing navigation logic.'
      };
    }
    
    // Check for immediate back-and-forth navigation
    if (recentNavigations.length >= 4) {
      const lastFour = recentNavigations.slice(-4);
      const paths = lastFour.map(nav => `${nav.from}->${nav.to}`);
      
      // Check for A->B->A->B pattern
      if (paths.length === 4 && paths[0] === paths[2] && paths[1] === paths[3]) {
        return {
          isInfiniteLoop: true,
          recentNavigations,
          suggestion: 'Back-and-forth navigation detected. Check route guards and auth logic.'
        };
      }
    }
    
    // Check for same-page redirects
    const samePageRedirects = recentNavigations.filter(
      nav => nav.from === nav.to && nav.action === 'redirect'
    );
    
    if (samePageRedirects.length >= 3) {
      return {
        isInfiniteLoop: true,
        recentNavigations,
        suggestion: 'Same-page redirects detected. Check redirect logic.'
      };
    }
    
    return {
      isInfiniteLoop: false,
      recentNavigations,
    };
  }
  
  private handleInfiniteLoop(detection: NavigationDetection) {
    // Log detailed information
    console.error('🚨 Navigation Loop Details:', {
      recentNavigations: detection.recentNavigations,
      suggestion: detection.suggestion,
      authStates: detection.recentNavigations.map(nav => ({
        timestamp: nav.timestamp,
        authState: nav.authState,
      })),
    });
    
    // Attempt to break the loop by going to a safe page
    console.log('🛑 Breaking navigation loop by going to home page');
    
    // Use a small delay to prevent immediate re-triggering
    setTimeout(() => {
      window.location.href = '/?loop_detected=true';
    }, 1000);
  }
  
  getNavigationHistory(): NavigationEvent[] {
    return [...this.navigationHistory];
  }
  
  getRecentNavigations(windowMs: number = 10000): NavigationEvent[] {
    const now = Date.now();
    return this.navigationHistory.filter(nav => now - nav.timestamp < windowMs);
  }
  
  clearHistory() {
    this.navigationHistory = [];
  }
  
  // Helper method to check if navigation should be throttled
  shouldThrottleNavigation(source: string, to: string): boolean {
    const recentNavs = this.getRecentNavigations(2000); // 2 seconds
    const similarNavs = recentNavs.filter(nav => 
      nav.source === source && nav.to === to
    );
    
    // Throttle if we've had more than 2 similar navigations in the last 2 seconds
    return similarNavs.length >= 2;
  }
}

// Create singleton instance
export const navigationDebugger = new NavigationDebugger();

// Helper function to create navigation events
export const createNavigationEvent = (
  source: string,
  action: string,
  from: string,
  to: string,
  reason: string,
  authState: NavigationEvent['authState'],
  additionalData?: any
): Omit<NavigationEvent, 'timestamp'> => {
  return {
    source,
    action,
    from,
    to,
    reason,
    authState,
    additionalData,
  };
};

// Export types for use in other files
export type { NavigationEvent, NavigationDetection }; 