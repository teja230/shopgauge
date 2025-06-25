import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

interface SessionNotificationOptions {
  redirect?: boolean;
  redirectDelay?: number;
  showToast?: boolean;
}

export const useSessionNotification = () => {
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const showSessionExpiredNotification = useCallback((options: SessionNotificationOptions = {}) => {
    const {
      redirect = false, // Changed default to false to prevent automatic redirects
      redirectDelay = 5000, // Increased delay to give users more time
      showToast = true
    } = options;

    console.log('SessionNotification: Showing session expired notification', { redirect, redirectDelay, showToast });

    if (showToast) {
      console.log('SessionNotification: Triggering toast notification');
      toast.error('Your session has expired. Please sign in again.', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          fontWeight: '500',
        },
        icon: '🔒',
      });
    }

    if (redirect && window.location.pathname !== '/') {
      // Clear any existing redirect timeout
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      
      console.log('SessionNotification: Scheduling redirect in', redirectDelay, 'ms');
      redirectTimeoutRef.current = setTimeout(() => {
        console.log('SessionNotification: Redirecting to home');
        window.location.href = '/';
      }, redirectDelay);
    }
  }, []);

  const showConnectionError = useCallback(() => {
    console.log('SessionNotification: Showing connection error notification');
    toast.error('Connection lost. Please check your internet connection.', {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#f59e0b',
        color: '#ffffff',
        fontWeight: '500',
      },
      icon: '📡',
    });
  }, []);

  const showGenericError = useCallback((message: string = 'Something went wrong. Please try again.') => {
    toast.error(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#ef4444',
        color: '#ffffff',
        fontWeight: '500',
      },
      icon: '⚠️',
    });
  }, []);

  // Cleanup function to clear timeouts
  const cleanup = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  return {
    showSessionExpired: showSessionExpiredNotification,
    showConnectionError,
    showGenericError,
    cleanup,
  };
}; 