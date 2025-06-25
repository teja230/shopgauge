import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Only show generic error notifications
    // Let AuthContext handle session-related errors
    if (!error.message.includes('Authentication required') && 
        !error.message.includes('session') && 
        !error.message.includes('expired')) {
      
      // For ErrorBoundary, we'll keep using toast since it's a class component
      // and we can't use hooks here. Consider converting to function component if needed.
      toast.error('Something went wrong. Please refresh the page.', {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          fontWeight: '500',
          borderRadius: '8px',
        },
        icon: '⚠️',
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 