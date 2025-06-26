import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ServiceStatusContextType {
  isServiceAvailable: boolean;
  lastServiceCheck: Date | null;
  checkServiceStatus: () => Promise<boolean>;
  handleServiceError: (error: any) => boolean;
  forceServiceUnavailable: () => void;
  resetServiceStatus: () => void;
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
  const navigate = useNavigate();

  const checkServiceStatus = async (): Promise<boolean> => {
    try {
      console.log('ServiceStatus: Checking service availability...');
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'include',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const available = response.ok;
      setIsServiceAvailable(available);
      setLastServiceCheck(new Date());
      
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
        return false;
      }
      
      // For other errors, assume service is available but has other issues
      setIsServiceAvailable(true);
      setLastServiceCheck(new Date());
      return true;
    }
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
      console.log('ServiceStatus: Detected 502/service unavailable error, navigating to service unavailable page');
      setIsServiceAvailable(false);
      setLastServiceCheck(new Date());
      navigate('/service-unavailable', { replace: true });
      return true; // Indicates we handled the error
    }

    return false; // Indicates we didn't handle the error
  };

  const forceServiceUnavailable = () => {
    console.log('ServiceStatus: Forcing service unavailable state');
    setIsServiceAvailable(false);
    setLastServiceCheck(new Date());
    navigate('/service-unavailable', { replace: true });
  };

  const resetServiceStatus = () => {
    console.log('ServiceStatus: Resetting service status to available');
    setIsServiceAvailable(true);
    setLastServiceCheck(new Date());
  };

  // Periodic health check (every 2 minutes when service is available)
  useEffect(() => {
    if (!isServiceAvailable) {
      return; // Don't check if we already know it's unavailable
    }

    const interval = setInterval(() => {
      checkServiceStatus();
    }, 120000); // Check every 2 minutes

    return () => clearInterval(interval);
  }, [isServiceAvailable]);

  // Initial health check
  useEffect(() => {
    // Only do initial check if we haven't checked recently
    if (!lastServiceCheck || Date.now() - lastServiceCheck.getTime() > 60000) {
      checkServiceStatus();
    }
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
      }}
    >
      {children}
    </ServiceStatusContext.Provider>
  );
};

export default ServiceStatusContext; 