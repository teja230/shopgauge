import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';

interface ServiceStatusContextType {
  isServiceAvailable: boolean;
  lastServiceCheck: Date | null;
  checkServiceStatus: () => Promise<boolean>;
  handleServiceError: (error: any) => boolean;
  forceServiceUnavailable: () => void;
  resetServiceStatus: () => void;
  retryCount: number;
}

const ServiceStatusContext = createContext<ServiceStatusContextType | undefined>(undefined);

export const useServiceStatus = () => {
  const context = useContext(ServiceStatusContext);
  if (context === undefined) {
    throw new Error('useServiceStatus must be used within a ServiceStatusProvider');
  }
  return context;
};

interface ServiceStatusProviderProps {
  children: React.ReactNode;
}

export const ServiceStatusProvider: React.FC<ServiceStatusProviderProps> = ({ children }) => {
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);
  const [lastServiceCheck, setLastServiceCheck] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRetryingRef = useRef(false);
  const lastSuccessfulCheckRef = useRef<Date | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const last502TimeRef = useRef<number>(0);
  const userNavigatedAwayRef = useRef(false);

  const checkServiceStatus = async (): Promise<boolean> => {
    // Debounce rapid successive calls
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 2000) { // 2 second debounce
      console.log('ServiceStatus: Debouncing rapid health check');
      return isServiceAvailable;
    }
    lastCheckTimeRef.current = now;

    try {
      console.log('ServiceStatus: Checking service availability...');
      const healthCheckUrl = `${API_BASE_URL}/api/health/summary`;
      console.log(`ServiceStatus: Pinging ${healthCheckUrl}`);
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        cache: 'no-cache',
        // credentials: 'include', // Health check should not require credentials
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const available = response.ok;
      setIsServiceAvailable(available);
      setLastServiceCheck(new Date());
      
      if (available) {
        // Service is back online - stop retrying and record successful check
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
        }
        setRetryCount(0);
        isRetryingRef.current = false;
        lastSuccessfulCheckRef.current = new Date();
        console.log('ServiceStatus: Service is back online, stopped retrying');
      }
      
      console.log('ServiceStatus: Service check result:', available);
      return available;
    } catch (error: any) {
      console.log('ServiceStatus: Service check failed:', error.message);
      
      // Check if it's a network error or 502-like error
      if (error.name === 'AbortError' || 
          error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('502') ||
          error.message.includes('Bad Gateway')) {
        setIsServiceAvailable(false);
        setLastServiceCheck(new Date());
        
        // Start retrying if not already retrying
        if (!isRetryingRef.current) {
          startRetryLoop();
        }
        
        return false;
      }
      
      // For other errors, assume service is available but has other issues
      setIsServiceAvailable(true);
      setLastServiceCheck(new Date());
      return true;
    }
  };

  const startRetryLoop = () => {
    if (isRetryingRef.current) {
      return; // Already retrying
    }

    // Don't start retrying if user has manually navigated away
    if (userNavigatedAwayRef.current) {
      console.log('ServiceStatus: Not starting retry loop - user has manually navigated away');
      return;
    }

    isRetryingRef.current = true;
    console.log('ServiceStatus: Starting retry loop - checking every 10 seconds');

    // Clear any existing interval
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    // Start retrying every 10 seconds (increased from 5 to reduce frequency)
    retryIntervalRef.current = setInterval(() => {
      // Double check if user has navigated away
      if (userNavigatedAwayRef.current) {
        console.log('ServiceStatus: Stopping retry loop - user has navigated away');
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
        }
        isRetryingRef.current = false;
        return;
      }
      
      setRetryCount(prev => prev + 1);
      checkServiceStatus();
    }, 10000); // Check every 10 seconds instead of 5
  };

  const handleServiceError = (error: any) => {
    console.log('ServiceStatus: Handling service error:', error);
    
    // Check if error indicates service unavailability
    const is502Error = 
      error?.response?.status === 502 ||
      error?.status === 502 ||
      error?.message?.includes('502') ||
      error?.message?.includes('Bad Gateway') ||
      error?.message?.includes('Service Unavailable') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('Network Error') ||
      (error?.response?.status >= 500 && error?.response?.status < 600);

    if (is502Error) {
      const now = Date.now();
      // Ignore the first transient 502 (within 10 s window) to prevent premature redirect
      if (now - last502TimeRef.current > 10_000) {
        // Record this 502 and allow one retry opportunity
        last502TimeRef.current = now;
      } else {
        console.log('ServiceStatus: Detected 502/service unavailable error, navigating to service unavailable page');
        setIsServiceAvailable(false);
        setLastServiceCheck(new Date());
        navigate('/service-unavailable', { replace: true });
        
        // Start retrying
        if (!isRetryingRef.current) {
          startRetryLoop();
        }
        return true; // handled
      }
    }

    return false; // Indicates we didn't handle the error
  };

  const forceServiceUnavailable = () => {
    console.log('ServiceStatus: Forcing service unavailable state');
    setIsServiceAvailable(false);
    setLastServiceCheck(new Date());
    navigate('/service-unavailable', { replace: true });
    
    // Start retrying
    if (!isRetryingRef.current) {
      startRetryLoop();
    }
  };

  const resetServiceStatus = () => {
    console.log('ServiceStatus: Resetting service status to available');
    setIsServiceAvailable(true);
    setLastServiceCheck(new Date());
    setRetryCount(0);
    lastSuccessfulCheckRef.current = new Date();
    userNavigatedAwayRef.current = true; // Mark that user manually reset
    
    // Stop retrying
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
    isRetryingRef.current = false;
  };

  // Monitor location changes to detect when user navigates away from error pages
  useEffect(() => {
    const currentPath = location.pathname;
    
    // If user navigates away from service-unavailable page, assume they found a working page
    if (currentPath !== '/service-unavailable' && !isServiceAvailable && isRetryingRef.current) {
      console.log('ServiceStatus: User navigated away from error page, assuming service is back online');
      userNavigatedAwayRef.current = true;
      
      // Reset service status to available and stop retrying
      setIsServiceAvailable(true);
      setLastServiceCheck(new Date());
      setRetryCount(0);
      lastSuccessfulCheckRef.current = new Date();
      
      // Stop retrying
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      isRetryingRef.current = false;
    }
  }, [location.pathname, isServiceAvailable]);

  // Initial health check - only if service is not available or we haven't checked recently
  useEffect(() => {
    const shouldCheck = 
      !isServiceAvailable || 
      !lastServiceCheck || 
      Date.now() - lastServiceCheck.getTime() > 60000 ||
      (lastSuccessfulCheckRef.current && Date.now() - lastSuccessfulCheckRef.current.getTime() > 300000); // 5 minutes

    // Additional check: if service is available and we checked recently, don't check again
    if (isServiceAvailable && lastServiceCheck && Date.now() - lastServiceCheck.getTime() < 300000) {
      console.log('ServiceStatus: Skipping initial health check - service is healthy and checked recently');
      return;
    }

    // Don't perform initial check if user has manually navigated away
    if (userNavigatedAwayRef.current) {
      console.log('ServiceStatus: Skipping initial health check - user manually navigated away');
      return;
    }

    if (shouldCheck) {
      console.log('ServiceStatus: Performing initial health check');
      checkServiceStatus();
    } else {
      console.log('ServiceStatus: Skipping initial health check - conditions not met');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, []);

  return (
    <ServiceStatusContext.Provider 
      value={{
        isServiceAvailable,
        lastServiceCheck,
        checkServiceStatus,
        handleServiceError,
        forceServiceUnavailable,
        resetServiceStatus,
        retryCount,
      }}
    >
      {children}
    </ServiceStatusContext.Provider>
  );
};

export default ServiceStatusContext; 