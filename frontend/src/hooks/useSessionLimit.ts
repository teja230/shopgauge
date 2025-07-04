import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface SessionInfo {
  sessionId: string;
  isCurrentSession: boolean;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress: string;
  userAgent: string;
  isExpired: boolean;
  expiresAt?: string;
}

interface SessionLimitResponse {
  limitReached: boolean;
  maxSessions: number;
  currentSessionCount: number;
  shop: string;
  currentSessionId: string;
  sessions: SessionInfo[];
  success: boolean;
  error?: string;
}

interface UseSessionLimitReturn {
  sessionLimitData: SessionLimitResponse | null;
  loading: boolean;
  showSessionDialog: boolean;
  checkSessionLimit: () => Promise<SessionLimitResponse | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  closeSessionDialog: () => void;
  openSessionDialog: () => void;
  canProceedWithLogin: () => boolean;
}

export const useSessionLimit = (): UseSessionLimitReturn => {
  const [sessionLimitData, setSessionLimitData] = useState<SessionLimitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  const checkSessionLimit = useCallback(async (): Promise<SessionLimitResponse | null> => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions/limit-check', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: SessionLimitResponse = await response.json();
        setSessionLimitData(data);
        
        // Automatically show dialog if limit is reached
        if (data.limitReached && data.success) {
          setShowSessionDialog(true);
        }
        
        return data;
      } else {
        console.error('Failed to check session limit:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error checking session limit:', error);
      toast.error('Failed to check session limit');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/sessions/terminate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Update local session data
          if (sessionLimitData) {
            const updatedSessions = sessionLimitData.sessions.filter(s => s.sessionId !== sessionId);
            setSessionLimitData({
              ...sessionLimitData,
              sessions: updatedSessions,
              currentSessionCount: updatedSessions.length,
              limitReached: updatedSessions.length >= sessionLimitData.maxSessions
            });
          }
          
          toast.success('Session removed successfully');
          return true;
        } else {
          toast.error(result.error || 'Failed to remove session');
          return false;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to remove session');
        return false;
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Network error while removing session');
      return false;
    }
  }, [sessionLimitData]);

  const closeSessionDialog = useCallback(() => {
    setShowSessionDialog(false);
  }, []);

  const openSessionDialog = useCallback(() => {
    setShowSessionDialog(true);
  }, []);

  const canProceedWithLogin = useCallback((): boolean => {
    if (!sessionLimitData) return true; // Allow if we haven't checked yet
    
    // Can proceed if limit is not reached or if current session already exists
    return !sessionLimitData.limitReached || 
           sessionLimitData.sessions.some(s => s.isCurrentSession);
  }, [sessionLimitData]);

  return {
    sessionLimitData,
    loading,
    showSessionDialog,
    checkSessionLimit,
    deleteSession,
    closeSessionDialog,
    openSessionDialog,
    canProceedWithLogin,
  };
};

export default useSessionLimit; 