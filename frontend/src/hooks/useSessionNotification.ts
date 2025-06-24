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
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        },
        icon: '🔒',
      });
    }

    if (redirect && window.location.pathname !== '/') {
      console.log('SessionNotification: Scheduling redirect in', redirectDelay, 'ms');
      setTimeout(() => {
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

  return {
    showSessionExpired,
    showConnectionError,
    showGenericError,
  };
}; 