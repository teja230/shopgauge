import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error details to console
    console.error('🚨 ERROR BOUNDARY CAUGHT ERROR:', error);
    console.error('🚨 Error Stack:', error.stack);
    console.error('🚨 Component Stack:', errorInfo.componentStack);
    console.error('🚨 Error Info:', errorInfo);
    
    // Also log to localStorage for persistence
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    };
    
    try {
      localStorage.setItem('dashboard-error-log', JSON.stringify(errorLog));
    } catch (e) {
      console.error('Failed to save error to localStorage:', e);
    }
    
    this.setState({ hasError: true, error });
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