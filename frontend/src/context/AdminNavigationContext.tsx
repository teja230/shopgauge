import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: ReactNode;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
  badge?: number;
}

export interface NavigationSection {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  children?: NavigationItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
}

export interface AdminUser {
  username: string;
  role: string;
  lastLogin?: Date;
}

interface AdminNavigationState {
  activeSection: string;
  sidebarCollapsed: boolean;
  breadcrumbs: BreadcrumbItem[];
  notifications: NotificationItem[];
  user: AdminUser | null;
}

interface AdminNavigationContextType {
  state: AdminNavigationState;
  setActiveSection: (section: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setUser: (user: AdminUser | null) => void;
}

const AdminNavigationContext = createContext<AdminNavigationContextType | undefined>(undefined);

export const useAdminNavigation = () => {
  const context = useContext(AdminNavigationContext);
  if (context === undefined) {
    throw new Error('useAdminNavigation must be used within an AdminNavigationProvider');
  }
  return context;
};

interface AdminNavigationProviderProps {
  children: ReactNode;
}

export const AdminNavigationProvider: React.FC<AdminNavigationProviderProps> = ({ children }) => {
  const [state, setState] = useState<AdminNavigationState>({
    activeSection: 'dashboard',
    sidebarCollapsed: false,
    breadcrumbs: [{ label: 'Dashboard', icon: null }],
    notifications: [],
    user: null,
  });

  const setActiveSection = useCallback((section: string) => {
    setState(prev => ({ ...prev, activeSection: section }));
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState(prev => ({ ...prev, sidebarCollapsed: collapsed }));
  }, []);

  const setBreadcrumbs = useCallback((breadcrumbs: BreadcrumbItem[]) => {
    setState(prev => ({ ...prev, breadcrumbs }));
  }, []);

  const addNotification = useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setState(prev => ({
      ...prev,
      notifications: [newNotification, ...prev.notifications].slice(0, 50), // Keep only last 50 notifications
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      ),
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  const setUser = useCallback((user: AdminUser | null) => {
    setState(prev => ({ ...prev, user }));
  }, []);

  const contextValue: AdminNavigationContextType = {
    state,
    setActiveSection,
    setSidebarCollapsed,
    setBreadcrumbs,
    addNotification,
    markNotificationRead,
    clearNotifications,
    setUser,
  };

  return (
    <AdminNavigationContext.Provider value={contextValue}>
      {children}
    </AdminNavigationContext.Provider>
  );
};