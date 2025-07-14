import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionExtensionPromptProps {
  expiresInMinutes: number;
  gracePeriodMinutes?: number;
  onExtend: () => Promise<boolean>;
  onDismiss: () => void;
  onLogout: () => void;
}

interface SessionExtensionPromptState {
  isVisible: boolean;
  expiresInMinutes: number;
  gracePeriodMinutes: number;
  countdown: number;
  isExtending: boolean;
  extensionSuccess: boolean | null;
}

const SessionExtensionPrompt: React.FC<SessionExtensionPromptProps> = ({
  expiresInMinutes,
  gracePeriodMinutes = 2,
  onExtend,
  onDismiss,
  onLogout
}) => {
  const [state, setState] = useState<SessionExtensionPromptState>({
    isVisible: true,
    expiresInMinutes,
    gracePeriodMinutes,
    countdown: gracePeriodMinutes * 60, // Convert to seconds
    isExtending: false,
    extensionSuccess: null
  });

  const { addNotification } = useNotifications();

  // Countdown timer for grace period
  useEffect(() => {
    if (state.countdown <= 0) {
      // Grace period expired, logout user
      addNotification('Session expired. Logging you out.', 'error', {
        persistent: true,
        category: 'Authentication'
      });
      onLogout();
      return;
    }

    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        countdown: prev.countdown - 1
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [state.countdown, onLogout, addNotification]);

  // Update countdown display
  useEffect(() => {
    const minutes = Math.floor(state.countdown / 60);
    const seconds = state.countdown % 60;
    
    // Update document title to show countdown
    if (state.countdown <= 60) { // Only show in last minute
      document.title = `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')} - ShopGauge`;
    } else {
      document.title = 'ShopGauge';
    }
  }, [state.countdown]);

  const handleExtend = useCallback(async () => {
    setState(prev => ({ ...prev, isExtending: true }));
    
    try {
      const success = await onExtend();
      
      if (success) {
        setState(prev => ({ 
          ...prev, 
          isExtending: false, 
          extensionSuccess: true,
          isVisible: false 
        }));
        
        addNotification('Session extended successfully!', 'success', {
          duration: 5000,
          category: 'Authentication'
        });
        
        // Reset document title
        document.title = 'ShopGauge';
        
        // Hide the prompt after success
        setTimeout(() => {
          onDismiss();
        }, 1000);
      } else {
        setState(prev => ({ 
          ...prev, 
          isExtending: false, 
          extensionSuccess: false 
        }));
        
        addNotification('Failed to extend session. Please try again.', 'error', {
          duration: 5000,
          category: 'Authentication'
        });
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isExtending: false, 
        extensionSuccess: false 
      }));
      
      addNotification('Network error while extending session.', 'error', {
        duration: 5000,
        category: 'Authentication'
      });
    }
  }, [onExtend, onDismiss, addNotification]);

  const handleDismiss = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    onDismiss();
  }, [onDismiss]);

  const handleLogout = useCallback(() => {
    addNotification('Logging out due to session expiration.', 'warning', {
      duration: 3000,
      category: 'Authentication'
    });
    onLogout();
  }, [onLogout, addNotification]);

  // Format countdown display
  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if session is in grace period
  const isInGracePeriod = state.expiresInMinutes <= 0;
  const isCritical = state.countdown <= 30; // Last 30 seconds

  if (!state.isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`relative max-w-md w-full mx-4 p-6 rounded-lg shadow-xl transition-all duration-300 ${
        isCritical 
          ? 'bg-red-50 border-2 border-red-300' 
          : isInGracePeriod 
            ? 'bg-orange-50 border-2 border-orange-300'
            : 'bg-blue-50 border-2 border-blue-300'
      }`}>
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={state.isExtending}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
            isCritical 
              ? 'bg-red-100 text-red-600' 
              : isInGracePeriod 
                ? 'bg-orange-100 text-orange-600'
                : 'bg-blue-100 text-blue-600'
          }`}>
            {isCritical ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          <h3 className={`text-lg font-semibold ${
            isCritical ? 'text-red-800' : isInGracePeriod ? 'text-orange-800' : 'text-blue-800'
          }`}>
            {isCritical 
              ? 'Session Expiring Soon!' 
              : isInGracePeriod 
                ? 'Session Expired' 
                : 'Session Extension Required'
            }
          </h3>
        </div>

        {/* Message */}
        <div className="text-center mb-6">
          <p className={`text-sm ${
            isCritical ? 'text-red-700' : isInGracePeriod ? 'text-orange-700' : 'text-blue-700'
          }`}>
            {isCritical 
              ? `Your session will expire in ${formatCountdown(state.countdown)}. Extend now to continue working.`
              : isInGracePeriod 
                ? `Your session has expired. You will be logged out in ${formatCountdown(state.countdown)} unless you extend your session.`
                : `Your session will expire in ${state.expiresInMinutes} minutes. Would you like to extend it?`
            }
          </p>
        </div>

        {/* Countdown display */}
        {isInGracePeriod && (
          <div className="text-center mb-4">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isCritical 
                ? 'bg-red-100 text-red-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatCountdown(state.countdown)} remaining
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleExtend}
            disabled={state.isExtending}
            className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
              state.isExtending
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isCritical
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : isInGracePeriod
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {state.isExtending ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Extending...
              </div>
            ) : (
              'Extend Session'
            )}
          </button>

          {isInGracePeriod && (
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 rounded-md font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
            >
              Logout Now
            </button>
          )}

          {!isInGracePeriod && (
            <button
              onClick={handleDismiss}
              disabled={state.isExtending}
              className="w-full py-2 px-4 rounded-md font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          )}
        </div>

        {/* Success/Error message */}
        {state.extensionSuccess !== null && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            state.extensionSuccess 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {state.extensionSuccess 
              ? '✅ Session extended successfully!' 
              : '❌ Failed to extend session. Please try again.'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionExtensionPrompt; 