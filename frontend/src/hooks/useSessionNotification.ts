import { useCallback } from 'react';
import toast from 'react-hot-toast';

interface SessionNotificationOptions {
  redirect?: boolean;
  redirectDelay?: number;
  showToast?: boolean;
}

export const useSessionNotification = () => {
  const showSessionExpired = useCallback((options: SessionNotificationOptions = {}) => {
    const {
      redirect = true,
      redirectDelay = 2000,
      showToast = true
    } = options;

    if (showToast) {
      toast.error('Your session has expired. Please sign in again.', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          fontWeight: '500',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        },
        icon: '🔒',
      });
    }

    if (redirect && window.location.pathname !== '/') {
      setTimeout(() => {
        window.location.href = '/';
      }, redirectDelay);
    }
  }, []);

  const showConnectionError = useCallback(() => {
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

  return {
    showSessionExpired,
    showConnectionError,
    showGenericError,
  };
}; 